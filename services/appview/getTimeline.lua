-- social.respawn.feed.getTimeline
--
-- Activity from the accounts `viewer` follows: backlog adds and follows, newest
-- first. Attach in HappyView as `xrpc.query:social.respawn.feed.getTimeline`.
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

local function follow_subjects(d, viewer)
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
	local rows = db.raw(sql, { FOLLOW, viewer, MAX_FOLLOWS })

	local dids, seen = {}, {}
	for _, row in ipairs(rows) do
		local subject = row.subject
		-- Never surface the viewer's own activity back to them.
		if subject and subject ~= '' and subject ~= viewer and not seen[subject] then
			seen[subject] = true
			table.insert(dids, subject)
		end
	end
	return dids
end

function handle()
	local viewer = params.viewer
	if not viewer or viewer == '' then
		error('viewer is required')
	end
	local limit = clamp_limit(params.limit)
	local d = dialect()

	local dids = follow_subjects(d, viewer)
	if #dids == 0 then
		return { feed = toarray({}) }
	end

	local binds = { BACKLOG, FOLLOW }
	local placeholders = {}
	for _, did in ipairs(dids) do
		table.insert(binds, did)
		table.insert(placeholders, d.ph(#binds))
	end

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
		.. ') AND did IN ('
		.. table.concat(placeholders, ', ')
		.. ')'
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
