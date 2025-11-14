local setKey = KEYS[1]
local activeLeaseKey = KEYS[2]
local preLeaseKey = KEYS[3]

local callId = ARGV[1]
local preMember = ARGV[2]
local campaignId = ARGV[3]
local shouldPublish = ARGV[4]

local removedType = 0

if redis.call('DEL', activeLeaseKey) > 0 then
  redis.call('SREM', setKey, callId)
  removedType = 1
elseif redis.call('DEL', preLeaseKey) > 0 then
  redis.call('SREM', setKey, preMember)
  removedType = 2
end

if removedType > 0 and shouldPublish == '1' then
  redis.call('PUBLISH', 'campaign:' .. campaignId .. ':release', callId)
end

return removedType


