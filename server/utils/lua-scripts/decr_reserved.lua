local reservedKey = KEYS[1]
local amount = tonumber(ARGV[1] or "1")

local value = redis.call('DECRBY', reservedKey, amount)
if value < 0 then
  redis.call('SET', reservedKey, 0)
  value = 0
end

return value


