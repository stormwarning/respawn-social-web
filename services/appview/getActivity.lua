-- social.respawn.feed.getActivity
--
-- Activity events involving `actor`, newest first. `filter` picks the slice:
-- `author` (records they wrote), `following` (records by the accounts they
-- follow), `incoming` (records by others naming them as subject), or `all`
-- (the union). Attach in HappyView as
-- `xrpc.query:social.respawn.feed.getActivity`.
--
-- `incoming` only ever means "someone followed you" for now: follow is the
-- single indexed collection carrying a subject. Indexing likes or comments
-- means adding the collection to the `collection IN (…)` list, mapping its
-- record onto a #feedItem, and widening the incoming clause to its subject
-- field.
--
-- db.query can't filter by a set of DIDs and orders by index time rather than
-- the record's own createdAt, so this goes through db.raw. Placeholders and JSON
-- access differ per backend, hence the db.backend() branches.
--
-- Every `db` call lives inside handle(): HappyView validates an uploaded script
-- by executing the chunk in a sandbox where only `env` exists, so touching `db`
-- at the top level fails the upload with "attempt to index a nil value".

local BACKLOG = 'social.respawn.backlog.item'
local FOLLOW = 'social.respawn.graph.follow'
local MAX_FOLLOWS = 500
local DEFAULT_LIMIT = 30
local MAX_LIMIT = 50
local FILTERS = { all = true, author = true, incoming = true, following = true }

-- SQL varies by backend: `$1,$2,…` vs `?` placeholders, and JSON field access.
local function dialect()
	local is_pg = db.backend() == 'postgres'
	local d = {}

	function d.ph(n)
		if is_pg then return '$' .. n end
		return '?'
	end

	function d.json_text(field)
		if is_pg then return "(record->>'" .. field .. "')" end
		return "json_extract(record, '$." .. field .. "')"
	end

	d.record_text = is_pg and 'record::text' or 'record'
	d.created_at = d.json_text('createdAt')
	return d
end

local function clamp_limit(raw)
	local n = tonumber(raw) or DEFAULT_LIMIT
	if n < 1 then return DEFAULT_LIMIT end
	if n > MAX_LIMIT then return MAX_LIMIT end
	return math.floor(n)
end

-- Cursor is `<createdAt>::<uri>`. ISO timestamps never contain `::`, and an
-- at-uri only ever has single colons, so the first `::` is the separator.
local function split_cursor(cursor)
	if not cursor or cursor == '' then return nil, nil end
	local at = string.find(cursor, '::', 1, true)
	if not at then return nil, nil end
	return string.sub(cursor, 1, at - 1), string.sub(cursor, at + 2)
end

local function follow_subjects(d, actor)
	local sql = 'SELECT '
		.. d.json_text('subject')
		.. ' AS subject FROM happyview_records WHERE collection = '
		.. d.ph(1)
		.. ' AND did = '
		.. d.ph(2)
		.. ' ORDER BY '
		.. d.created_at
		.. ' DESC LIMIT '
		.. d.ph(3)
	local rows = db.raw(sql, { FOLLOW, actor, MAX_FOLLOWS })

	local dids, seen = {}, {}
	for _, row in ipairs(rows) do
		local subject = row.subject
		-- The actor's own activity belongs to the `author` slice, not this one.
		if subject and subject ~= '' and subject ~= actor and not seen[subject] then
			seen[subject] = true
			table.insert(dids, subject)
		end
	end
	return dids
end

-- Which authors the requested slice covers. `incoming` filters on subject
-- instead, so it contributes nobody here.
local function author_dids(d, filter, actor)
	if filter == 'author' then return { actor } end
	if filter == 'following' then return follow_subjects(d, actor) end
	if filter == 'all' then
		local dids = follow_subjects(d, actor)
		table.insert(dids, actor)
		return dids
	end
	return {}
end

function handle()
	local actor = params.actor
	if not actor or actor == '' then
		error('actor is required')
	end
	local filter = params.filter
	if not filter or filter == '' then filter = 'all' end
	if not FILTERS[filter] then
		error('unknown filter: ' .. tostring(filter))
	end
	local limit = clamp_limit(params.limit)
	local d = dialect()

	local dids = author_dids(d, filter, actor)
	local want_incoming = filter == 'incoming' or filter == 'all'
	-- `all` still has work to do with zero follows; `following` does not.
	if #dids == 0 and not want_incoming then
		return { feed = toarray({}) }
	end

	-- Binds are positional on SQLite, so every value is appended in the order its
	-- placeholder appears in the finished statement.
	local binds = { BACKLOG, FOLLOW }
	local clauses = {}

	if #dids > 0 then
		local placeholders = {}
		for _, did in ipairs(dids) do
			table.insert(binds, did)
			table.insert(placeholders, d.ph(#binds))
		end
		table.insert(clauses, 'did IN (' .. table.concat(placeholders, ', ') .. ')')
	end

	if want_incoming then
		-- Scoped to follows: no other indexed collection has a subject, and the
		-- narrower clause keeps the JSON comparison off every backlog row.
		table.insert(binds, FOLLOW)
		local collection_ph = d.ph(#binds)
		table.insert(binds, actor)
		local subject_ph = d.ph(#binds)
		table.insert(binds, actor)
		local author_ph = d.ph(#binds)
		table.insert(
			clauses,
			'(collection = '
				.. collection_ph
				.. ' AND '
				.. d.json_text('subject')
				.. ' = '
				.. subject_ph
				.. ' AND did <> '
				.. author_ph
				.. ')'
		)
	end

	-- A row matching both clauses is still one row, so the OR needs no dedupe.
	local scope_clause = ' AND (' .. table.concat(clauses, ' OR ') .. ')'

	local cursor_clause = ''
	local cursor_ts, cursor_uri = split_cursor(params.cursor)
	if cursor_ts and cursor_uri then
		-- SQLite's `?` is positional, so the timestamp is bound once per use
		-- rather than reusing a single placeholder.
		table.insert(binds, cursor_ts)
		local ts_lt_ph = d.ph(#binds)
		table.insert(binds, cursor_ts)
		local ts_eq_ph = d.ph(#binds)
		table.insert(binds, cursor_uri)
		local uri_ph = d.ph(#binds)
		cursor_clause = ' AND ('
			.. d.created_at
			.. ' < '
			.. ts_lt_ph
			.. ' OR ('
			.. d.created_at
			.. ' = '
			.. ts_eq_ph
			.. ' AND uri < '
			.. uri_ph
			.. '))'
	end

	-- One extra row tells us whether another page exists.
	table.insert(binds, limit + 1)
	local limit_ph = d.ph(#binds)

	local sql = 'SELECT uri, did, collection, '
		.. d.record_text
		.. ' AS record, '
		.. d.created_at
		.. ' AS ts FROM happyview_records WHERE collection IN ('
		.. d.ph(1)
		.. ', '
		.. d.ph(2)
		.. ')'
		.. scope_clause
		.. cursor_clause
		.. ' ORDER BY ts DESC, uri DESC LIMIT '
		.. limit_ph

	local rows = db.raw(sql, binds)

	local feed = {}
	local next_cursor = nil
	for i, row in ipairs(rows) do
		if i > limit then
			local last = rows[limit]
			next_cursor = last.ts .. '::' .. last.uri
			break
		end

		local rec = json.decode(row.record)
		local item = {
			uri = row.uri,
			did = row.did,
			createdAt = rec.createdAt or row.ts,
		}
		if row.collection == BACKLOG then
			item.type = 'backlogAdd'
			item.game = rec.game
			item.cover = rec.cover
		else
			item.type = 'follow'
			item.subject = rec.subject
		end
		table.insert(feed, item)
	end

	return { feed = toarray(feed), cursor = next_cursor }
end
