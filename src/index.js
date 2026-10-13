const { Client, GatewayIntentBits, Events, ActivityType } = require('discord.js');
const config = require('./config');
const { handleInteraction } = require('./handlers/interactions');

if (!config.token) {
  console.error('❌ DISCORD_TOKEN belum diisi di .env');
  process.exit(1);
}
if (!config.robloxApiKey) {
  console.warn('⚠️  ROBLOX_API_KEY belum diisi. Status public/private tidak bisa dicek (hasilnya akan "Gagal dicek").');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Login sebagai ${c.user.tag}`);
  c.user.setActivity('cek ID boombox 🎵', { type: ActivityType.Watching });
});

client.on(Events.InteractionCreate, handleInteraction);

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

client.login(config.token);
