-- social.respawn.feed.getTimeline
--
-- Activity from the accounts `viewer` follows: backlog adds and follows, newest
-- first. Attach in HappyView as `xrpc.query:social.respawn.feed.getTimeline`.
--
-- db.query can't filter by a set of DIDs and orders by index time rather than
-- the record's own createdAt, so this goes through db.raw. Placeholders and JSON
-- access differ per backend, hence the db.backend() branches.

local BACKLOG = 'social.respawn.backlog.item'
local FOLLOW = 'social.respawn.graph.follow'
local MAX_FOLLOWS = 500
local DEFAULT_LIMIT = 30
local MAX_LIMIT = 50

local backend = db.backend()
local is_pg = backend == 'postgres'

-- $1,$2,… on Postgres; ? on SQLite.
local function ph(n)
	if is_pg then return '$' .. n end
	return '?'
end

local function json_text(field)
	if is_pg then return "(record->>'" .. field .. "')" end
	return "json_extract(record, '$." .. field .. "')"
end

local function record_text()
	if is_pg then return 'record::text' end
	return 'record'
end

local CREATED_AT = json_text('createdAt')

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

local function follow_subjects(viewer)
	local sql = 'SELECT '
		.. json_text('subject')
		.. ' AS subject FROM happyview_records WHERE collection = '
		.. ph(1)
		.. ' AND did = '
		.. ph(2)
		.. ' ORDER BY '
		.. CREATED_AT
		.. ' DESC LIMIT '
		.. ph(3)
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

	local dids = follow_subjects(viewer)
	if #dids == 0 then
		return { feed = toarray({}) }
	end

	local binds = { BACKLOG, FOLLOW }
	local placeholders = {}
	for _, did in ipairs(dids) do
		table.insert(binds, did)
		table.insert(placeholders, ph(#binds))
	end

	local cursor_clause = ''
	local cursor_ts, cursor_uri = split_cursor(params.cursor)
	if cursor_ts and cursor_uri then
		-- SQLite's `?` is positional, so the timestamp is bound once per use
		-- rather than reusing a single placeholder.
		table.insert(binds, cursor_ts)
		local ts_lt_ph = ph(#binds)
		table.insert(binds, cursor_ts)
		local ts_eq_ph = ph(#binds)
		table.insert(binds, cursor_uri)
		local uri_ph = ph(#binds)
		cursor_clause = ' AND ('
			.. CREATED_AT
			.. ' < '
			.. ts_lt_ph
			.. ' OR ('
			.. CREATED_AT
			.. ' = '
			.. ts_eq_ph
			.. ' AND uri < '
			.. uri_ph
			.. '))'
	end

	-- One extra row tells us whether another page exists.
	table.insert(binds, limit + 1)
	local limit_ph = ph(#binds)

	local sql = 'SELECT uri, did, collection, '
		.. record_text()
		.. ' AS record, '
		.. CREATED_AT
		.. ' AS ts FROM happyview_records WHERE collection IN ('
		.. ph(1)
		.. ', '
		.. ph(2)
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
