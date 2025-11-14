local setKey = KEYS[1]
local preLeaseKey = KEYS[2]
local activeLeaseKey = KEYS[3]

local callId = ARGV[1]
local preMember = ARGV[2]
local preToken = ARGV[3]
local activeToken = ARGV[4]
local ttl = tonumber(ARGV[5] or "0")

local storedToken = redis.call('GET', preLeaseKey)
if storedToken ~= preToken then
  return nil
end

redis.call('DEL', preLeaseKey)
redis.call('SREM', setKey, preMember)
redis.call('SADD', setKey, callId)

if ttl > 0 then
  redis.call('SET', activeLeaseKey, activeToken, 'EX', ttl)
else
  redis.call('SET', activeLeaseKey, activeToken)
end

return activeToken


