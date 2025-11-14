local reservedKey = KEYS[1]
local ledgerKey = KEYS[2]

local jobId = ARGV[1]

local removed = redis.call('ZREM', ledgerKey, jobId)
if removed > 0 then
  redis.call('DECR', reservedKey)
  return removed
end

return 0


