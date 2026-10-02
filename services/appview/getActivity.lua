-- social.respawn.feed.getActivity
--
-- Activity events involving `actor`, newest first. `filter` picks the slice:
-- `author` (records they wrote), `following` (records by the accounts they
-- follow), `incoming` (records by others naming them as subject), or `all`
-- (the union). Attach in HappyView as
-- `xrpc.query:social.respawn.feed.getActivity`.
--
-- Event types: backlog adds, follows, logs, and likes of logs. `incoming` is
-- "someone followed you" or "someone liked your log". Likes of anything other
-- than a log, likes of your own log, and likes of a log without a review (only
-- a review can be liked; another client may still write one, or the author may
-- remove the review later) are left out. Indexing comments means
-- adding the collection to the `collection IN (…)` list, mapping its record
-- onto a #feedItem, and widening the incoming clause to its subject field.
--
-- The feed orders logs by their createdAt like everything else; `datePlayed`
-- is for the profile. Logs of unreleased games are held back by the web app,
-- which asks the game backend for a fresh release date on every read.
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
local LOG = 'social.respawn.feed.log'
local LIKE = 'social.respawn.feed.like'
-- A liked log's at-uri contains this; a liked list or comment's doesn't.
local LOG_PATH = '/' .. LOG .. '/'
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

	-- `record` is TEXT on Postgres (migration 20260318000000 converted it from
	-- JSONB), so `->>` has no operator without a cast. The cast is a no-op on an
	-- instance old enough to still store JSONB. `path` is dotted for nested
	-- fields, e.g. `subject.uri`.
	function d.json_text(path)
		if not is_pg then return "json_extract(record, '$." .. path .. "')" end
		local keys = {}
		for key in string.gmatch(path, '[^.]+') do
			table.insert(keys, "'" .. key .. "'")
		end
		local last = table.remove(keys)
		local prefix = '(record::jsonb'
		for _, key in ipairs(keys) do
			prefix = prefix .. '->' .. key
		end
		return prefix .. '->>' .. last .. ')'
	end

	-- 1-based position of `needle` in `haystack`, 0 when absent.
	function d.position(haystack, needle)
		if is_pg then return 'strpos(' .. haystack .. ', ' .. needle .. ')' end
		return 'instr(' .. haystack .. ', ' .. needle .. ')'
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

-- A log the feed can show and link to: one with a game slug to address it by.
local function is_log(record)
	return type(record) == 'table' and type(record.game) == 'table' and record.game.slug ~= nil
end

-- Mirrors `hasReview` in the web app: review text, or a link out to one.
local function has_review(record)
	local review = record.review
	if type(review) ~= 'table' then return false end
	if type(review.text) == 'string' and string.find(review.text, '%S') then return true end
	return type(review.external) == 'table'
end

-- Logs by uri, for the likes on a page. A like whose log isn't indexed
-- (deleted, or not backfilled yet), or no longer has a review, gets nothing
-- back and drops out.
local function fetch_logs(d, uris)
	local found = {}
	if #uris == 0 then return found end

	local binds = { LOG }
	local placeholders = {}
	for _, uri in ipairs(uris) do
		table.insert(binds, uri)
		table.insert(placeholders, d.ph(#binds))
	end
	local sql = 'SELECT uri, did, '
		.. d.record_text
		.. ' AS record FROM happyview_records WHERE collection = '
		.. d.ph(1)
		.. ' AND uri IN ('
		.. table.concat(placeholders, ', ')
		.. ')'

	for _, row in ipairs(db.raw(sql, binds)) do
		local record = json.decode(row.record)
		if is_log(record) and has_review(record) then
			found[row.uri] = { uri = row.uri, did = row.did, record = record }
		end
	end
	return found
end

-- Each log's 1-based position among its author's logs of the same game, oldest
-- first. The web app numbers a log page the same way (`loadLog`), so the number
-- addresses `/<handle>/game/<slug>/<n>/`.
local function number_logs(d, logs)
	local numbers = {}
	if #logs == 0 then return numbers end

	-- Placeholders are appended in statement order: the did list, then slugs.
	local binds = { LOG }
	local did_phs, slug_phs = {}, {}
	local seen_did, seen_slug = {}, {}
	for _, log in ipairs(logs) do
		if not seen_did[log.did] then
			seen_did[log.did] = true
			table.insert(binds, log.did)
			table.insert(did_phs, d.ph(#binds))
		end
	end
	for _, log in ipairs(logs) do
		local slug = log.record.game.slug
		if not seen_slug[slug] then
			seen_slug[slug] = true
			table.insert(binds, slug)
			table.insert(slug_phs, d.ph(#binds))
		end
	end

	local slug_field = d.json_text('game.slug')
	local sql = 'SELECT uri, did, '
		.. slug_field
		.. ' AS slug, '
		.. d.created_at
		.. ' AS ts FROM happyview_records WHERE collection = '
		.. d.ph(1)
		.. ' AND did IN ('
		.. table.concat(did_phs, ', ')
		.. ') AND '
		.. slug_field
		.. ' IN ('
		.. table.concat(slug_phs, ', ')
		.. ')'

	-- DIDs never contain a space, so it separates the two halves of the key.
	local groups = {}
	for _, row in ipairs(db.raw(sql, binds)) do
		local key = row.did .. ' ' .. row.slug
		groups[key] = groups[key] or {}
		table.insert(groups[key], row)
	end
	for _, group in pairs(groups) do
		table.sort(group, function(a, b)
			local ta, tb = a.ts or '', b.ts or ''
			if ta ~= tb then return ta < tb end
			return a.uri < b.uri
		end)
		for i, row in ipairs(group) do
			numbers[row.uri] = i
		end
	end
	return numbers
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
	-- placeholder appears in the finished statement. Each bind() runs in its own
	-- statement because Lua leaves the evaluation order of `..` operands
	-- unspecified.
	local binds = {}
	local function bind(value)
		table.insert(binds, value)
		return d.ph(#binds)
	end

	local collection_phs = {}
	for _, collection in ipairs({ BACKLOG, FOLLOW, LOG, LIKE }) do
		table.insert(collection_phs, bind(collection))
	end

	local clauses = {}
	if #dids > 0 then
		local placeholders = {}
		for _, did in ipairs(dids) do
			table.insert(placeholders, bind(did))
		end
		table.insert(clauses, 'did IN (' .. table.concat(placeholders, ', ') .. ')')
	end

	local subject_uri = d.json_text('subject.uri')
	if want_incoming then
		-- Follows of the actor, and likes of the actor's logs. Each is scoped to
		-- its collection, so the JSON comparisons never touch other rows.
		local follow_ph = bind(FOLLOW)
		local subject_ph = bind(actor)
		local follow_author_ph = bind(actor)
		table.insert(
			clauses,
			'(collection = '
				.. follow_ph
				.. ' AND '
				.. d.json_text('subject')
				.. ' = '
				.. subject_ph
				.. ' AND did <> '
				.. follow_author_ph
				.. ')'
		)

		-- A prefix test by substr rather than LIKE, so nothing in a DID can act as
		-- a wildcard. The length is inlined: it is a number computed here, and a
		-- bound one would leave Postgres unable to type `length($n)`.
		local prefix = 'at://' .. actor .. LOG_PATH
		local like_ph = bind(LIKE)
		local prefix_ph = bind(prefix)
		local like_author_ph = bind(actor)
		table.insert(
			clauses,
			'(collection = '
				.. like_ph
				.. ' AND substr('
				.. subject_uri
				.. ', 1, '
				.. #prefix
				.. ') = '
				.. prefix_ph
				.. ' AND did <> '
				.. like_author_ph
				.. ')'
		)
	end

	-- A row matching several clauses is still one row, so the OR needs no dedupe.
	local scope_clause = ' AND (' .. table.concat(clauses, ' OR ') .. ')'

	-- Likes of lists or comments aren't feed events yet, and liking your own log
	-- isn't news. `'at://' || did || '/'` is the liker's own repo prefix.
	local not_like_ph = bind(LIKE)
	local log_path_ph = bind(LOG_PATH)
	local like_clause = ' AND (collection <> '
		.. not_like_ph
		.. ' OR ('
		.. d.position(subject_uri, log_path_ph)
		.. " > 0 AND substr("
		.. subject_uri
		.. ", 1, length(did) + 6) <> 'at://' || did || '/'))"

	local cursor_clause = ''
	local cursor_ts, cursor_uri = split_cursor(params.cursor)
	if cursor_ts and cursor_uri then
		-- SQLite's `?` is positional, so the timestamp is bound once per use
		-- rather than reusing a single placeholder.
		local ts_lt_ph = bind(cursor_ts)
		local ts_eq_ph = bind(cursor_ts)
		local uri_ph = bind(cursor_uri)
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
	local limit_ph = bind(limit + 1)

	local sql = 'SELECT uri, did, collection, '
		.. d.record_text
		.. ' AS record, '
		.. d.created_at
		.. ' AS ts FROM happyview_records WHERE collection IN ('
		.. table.concat(collection_phs, ', ')
		.. ')'
		.. scope_clause
		.. like_clause
		.. cursor_clause
		.. ' ORDER BY ts DESC, uri DESC LIMIT '
		.. limit_ph

	local rows = db.raw(sql, binds)

	local page = {}
	local next_cursor = nil
	for i, row in ipairs(rows) do
		if i > limit then
			local last = rows[limit]
			next_cursor = last.ts .. '::' .. last.uri
			break
		end
		table.insert(page, { row = row, rec = json.decode(row.record) })
	end

	-- Likes carry only their log's uri; fetch the logs for the whole page at once.
	local liked_uris = {}
	for _, entry in ipairs(page) do
		local subject = entry.rec.subject
		if entry.row.collection == LIKE and type(subject) == 'table' and subject.uri then
			entry.liked_uri = subject.uri
			table.insert(liked_uris, subject.uri)
		end
	end
	local liked = fetch_logs(d, liked_uris)

	-- Every log the page shows, written or liked, needs its number.
	local logs = {}
	for _, entry in ipairs(page) do
		if entry.row.collection == LOG and is_log(entry.rec) then
			entry.log = { uri = entry.row.uri, did = entry.row.did, record = entry.rec }
		elseif entry.liked_uri then
			entry.log = liked[entry.liked_uri]
		end
		if entry.log then table.insert(logs, entry.log) end
	end
	local numbers = number_logs(d, logs)

	local feed = {}
	for _, entry in ipairs(page) do
		local row, rec = entry.row, entry.rec
		local item = {
			uri = row.uri,
			did = row.did,
			createdAt = rec.createdAt or row.ts,
		}
		if row.collection == BACKLOG then
			item.type = 'backlogAdd'
			item.game = rec.game
			item.cover = rec.cover
		elseif row.collection == FOLLOW then
			item.type = 'follow'
			item.subject = rec.subject
		elseif entry.log then
			item.type = row.collection == LOG and 'log' or 'logLike'
			item.game = entry.log.record.game
			item.log = {
				uri = entry.log.uri,
				did = entry.log.did,
				number = numbers[entry.log.uri] or 1,
				record = entry.log.record,
			}
		end
		-- A like whose log is gone, or a malformed log, has nothing to show.
		if item.type then table.insert(feed, item) end
	end

	return { feed = toarray(feed), cursor = next_cursor }
end
