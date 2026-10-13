const { Client, GatewayIntentBits, Events, ActivityType } = require('discord.js');
const config = require('./config');
const { handleInteraction } = require('./handlers/interactions');
const sticky = require('./sticky');

if (!config.token) {
  console.error('❌ DISCORD_TOKEN belum diisi di .env');
  process.exit(1);
}
if (!config.robloxApiKey) {
  console.warn('⚠️  ROBLOX_API_KEY belum diisi. Status public/private tidak bisa dicek (hasilnya akan "Gagal dicek").');
}

// GuildMessages dibutuhkan untuk sticky panel (tahu kapan ada pesan baru).
// Tidak butuh MessageContent karena isi pesan tidak dibaca.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Login sebagai ${c.user.tag}`);
  c.user.setActivity('cek ID boombox 🎵', { type: ActivityType.Watching });
  await sticky.restoreAll(c);
});

client.on(Events.InteractionCreate, handleInteraction);
client.on(Events.MessageCreate, (message) => sticky.onMessage(message));

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

client.login(config.token);
