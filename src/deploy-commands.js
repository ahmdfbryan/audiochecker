const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config');

const commands = [
  new SlashCommandBuilder()
    .setName('panel-audio')
    .setDescription('Kirim panel Cek ID Boombox ke channel ini, selalu sticky di paling bawah (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('panel-audio-stop')
    .setDescription('Matikan panel sticky Cek ID Boombox di channel ini (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('cekaudio')
    .setDescription('Cek satu atau banyak ID audio/boombox Roblox')
    .setDMPermission(false)
    .addStringOption((opt) => opt
      .setName('ids')
      .setDescription('ID audio, pisahkan dengan spasi atau koma (contoh: 1837849285 9046863579)')
      .setRequired(true)
      .setMaxLength(6000)),
].map((c) => c.toJSON());

(async () => {
  if (!config.token || !config.clientId) {
    console.error('❌ DISCORD_TOKEN dan CLIENT_ID wajib diisi di .env');
    process.exit(1);
  }
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    const route = config.guildId
      ? Routes.applicationGuildCommands(config.clientId, config.guildId)
      : Routes.applicationCommands(config.clientId);
    await rest.put(route, { body: commands });
    console.log(`✅ ${commands.length} slash command terdaftar ${config.guildId ? `di server ${config.guildId}` : 'secara global'}.`);
  } catch (err) {
    console.error('❌ Gagal daftar command:', err);
    process.exit(1);
  }
})();
