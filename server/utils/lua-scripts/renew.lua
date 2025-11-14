local leaseKey = KEYS[1]
local coldStartKey = KEYS[2]

local token = ARGV[1]
local ttl = tonumber(ARGV[2] or "0")

if redis.call('GET', leaseKey) ~= token then
  return 0
end

if ttl > 0 then
  redis.call('EXPIRE', leaseKey, ttl)
  redis.call('SET', coldStartKey, '1', 'EX', ttl)
else
  redis.call('PERSIST', leaseKey)
end

return 1


