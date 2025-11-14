local setKey = KEYS[1]
local leaseKey = KEYS[2]
local limitKey = KEYS[3]

local callId = ARGV[1]
local member = ARGV[2]
local token = ARGV[3]
local ttl = tonumber(ARGV[4] or "0")

local limit = tonumber(redis.call('GET', limitKey) or "0")
local active = redis.call('SCARD', setKey)

if limit > 0 and active >= limit then
  return nil
end

redis.call('SADD', setKey, member)
if ttl > 0 then
  redis.call('SET', leaseKey, token, 'EX', ttl)
else
  redis.call('SET', leaseKey, token)
end

redis.call('PUBLISH', 'campaign:' .. callId .. ':events', 'lease_acquired')

return token


