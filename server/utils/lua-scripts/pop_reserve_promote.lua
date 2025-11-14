local highKey = KEYS[1]
local normalKey = KEYS[2]
local setKey = KEYS[3]
local limitKey = KEYS[4]
local reservedKey = KEYS[5]
local ledgerKey = KEYS[6]
local gateKey = KEYS[7]
local seqKey = KEYS[8]
local fairnessKey = KEYS[9]

local maxBatch = tonumber(ARGV[1] or "0")
local reservationTTL = tonumber(ARGV[2] or "0")
local gateTTL = tonumber(ARGV[3] or "0")
local now = tonumber(ARGV[4] or "0")

local limit = tonumber(redis.call('GET', limitKey) or "0")
local active = redis.call('SCARD', setKey)
local available = limit - active
if available < 0 then
  available = 0
end

if available > maxBatch then
  available = maxBatch
end

if available <= 0 then
  local seqVal = redis.call('GET', seqKey)
  if not seqVal then
    seqVal = 0
  end
  return {0, seqVal, {}, {}}
end

local promoteIds = {}

while available > 0 do
  local id = redis.call('LPOP', highKey)
  if not id then
    id = redis.call('LPOP', normalKey)
  end
  if not id then
    break
  end
  table.insert(promoteIds, id)
  available = available - 1
end

local count = table.getn(promoteIds)
if count == 0 then
  local seqVal = redis.call('GET', seqKey)
  if not seqVal then
    seqVal = 0
  end
  return {0, seqVal, {}, {}}
end

local seq = redis.call('INCR', seqKey)
redis.call('SET', gateKey, seq, 'EX', gateTTL)
redis.call('SET', fairnessKey, now)

for index, jobId in ipairs(promoteIds) do
  redis.call('ZADD', ledgerKey, now + index, jobId)
end

redis.call('INCRBY', reservedKey, count)
if reservationTTL > 0 then
  redis.call('EXPIRE', reservedKey, reservationTTL)
  redis.call('EXPIRE', ledgerKey, reservationTTL)
end

return {count, seq, promoteIds, {}}


