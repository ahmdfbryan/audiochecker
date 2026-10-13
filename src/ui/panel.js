const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const config = require('../config');

const IDS = Object.freeze({
  OPEN: 'audiochk:open',
  HELP: 'audiochk:help',
  MODAL: 'audiochk:modal',
  INPUT: 'audiochk:input',
});

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(config.colors.brand)
    .setTitle('🎵 Cek ID Boombox / Audio Roblox')
    .setDescription([
      'Mau tahu ID lagu kamu masih bisa diputar atau tidak? Cek di sini!',
      '',
      '**Cara pakai**',
      '1. Klik tombol **🎵 Cek Audio** di bawah',
      '2. Tempel satu atau banyak ID (boleh dipisah enter, spasi, atau koma)',
      `3. Kirim, dan bot akan cek hingga **${config.maxIds} ID** sekaligus`,
      '',
      '**Arti hasil**',
      '✅ **Bisa diputar**: audio public, jalan di semua map',
      '🔒 **Private**: hanya bisa diputar di game milik pembuatnya',
      '❌ **Tidak bisa**: ID salah, bukan audio, atau sudah dihapus',
    ].join('\n'))
    .setFooter({ text: 'KokoKrunch Studios • Audio Checker' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(IDS.OPEN).setLabel('Cek Audio').setEmoji('🎵').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(IDS.HELP).setLabel('Bantuan').setEmoji('❓').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

function buildModal() {
  const input = new TextInputBuilder()
    .setCustomId(IDS.INPUT)
    .setLabel(`Daftar ID audio (maks. ${config.maxIds})`)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('1837849285\n9046863579\nrbxassetid://1843463175')
    .setRequired(true)
    .setMaxLength(4000);

  return new ModalBuilder()
    .setCustomId(IDS.MODAL)
    .setTitle('Cek ID Boombox Roblox')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function buildHelp() {
  const embed = new EmbedBuilder()
    .setColor(config.colors.brand)
    .setTitle('❓ Bantuan Cek Audio')
    .setDescription([
      '**Format ID yang diterima**',
      '• Angka saja: `1837849285`',
      '• `rbxassetid://1837849285`',
      '• Link: `https://create.roblox.com/store/asset/1837849285`',
      '',
      'Bisa campur banyak format sekaligus. ID ganda otomatis dihitung satu kali.',
      '',
      '**Kenapa audio saya 🔒 Private?**',
      'Sejak 2022, Roblox membuat audio lebih dari 6 detik menjadi private secara default. Audio private hanya bisa diputar di game milik pembuatnya, jadi di map lain hasilnya diam.',
      '',
      '**Tips:** cari lagu dari **Creator Store** (Toolbox → Audio). Lagu dari Roblox dan partner musiknya selalu public.',
      '',
      'Kamu juga bisa pakai command `/cekaudio`.',
    ].join('\n'));
  return { embeds: [embed] };
}

module.exports = { IDS, buildPanel, buildModal, buildHelp };
