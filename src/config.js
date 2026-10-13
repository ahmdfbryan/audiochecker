require('dotenv').config();

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,

  robloxApiKey: (process.env.ROBLOX_API_KEY || '').trim(),

  maxIds: Math.min(toInt(process.env.MAX_IDS, 50), 200),
  concurrency: Math.min(toInt(process.env.CONCURRENCY, 3), 10),
  cooldownSec: toInt(process.env.COOLDOWN_SECONDS, 20),
  cacheMinutes: toInt(process.env.CACHE_MINUTES, 30),
  resultEphemeral: (process.env.RESULT_EPHEMERAL ?? 'false').toLowerCase() !== 'false',

  urls: {
    economy: (process.env.ROBLOX_ECONOMY_BASE || 'https://economy.roblox.com').replace(/\/$/, ''),
    openCloud: (process.env.ROBLOX_OPENCLOUD_BASE || 'https://apis.roblox.com').replace(/\/$/, ''),
  },

  colors: {
    brand: 0xf5a623,
    ok: 0x2ecc71,
    warn: 0xf1c40f,
    bad: 0xe74c3c,
  },
};
