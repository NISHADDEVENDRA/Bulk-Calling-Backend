local setKey = KEYS[1]
local leaseKey = KEYS[2]

local member = ARGV[1]
local token = ARGV[2]
local campaignId = ARGV[3]
local shouldPublish = ARGV[4]

local storedToken = redis.call('GET', leaseKey)
if storedToken ~= token then
  return 0
end

redis.call('DEL', leaseKey)
redis.call('SREM', setKey, member)

if shouldPublish == '1' then
  redis.call('PUBLISH', 'campaign:' .. campaignId .. ':release', member)
end

return 1


