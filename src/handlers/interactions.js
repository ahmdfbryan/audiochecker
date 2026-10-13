const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const { checkMany, parseIds } = require('../roblox/audioChecker');
const { IDS, buildModal, buildHelp } = require('../ui/panel');
const { setSticky, removeSticky } = require('../sticky');
const { buildResults } = require('../ui/results');

const cooldowns = new Map(); // userId -> timestamp boleh cek lagi
const running = new Set(); // userId yang sedang dicek (anti double submit)

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

function isStaff(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

/**
 * 10062 = Unknown interaction (lewat 3 detik / sudah dijawab proses lain)
 * 40060 = Interaction has already been acknowledged
 * Dua-duanya bukan bug di kode ini. Biasanya ada 2 proses bot yang jalan dengan token yang sama.
 */
function isStaleInteraction(err) {
  return err?.code === 10062 || err?.code === 40060;
}

function warnStale(where, interaction) {
  console.warn(
    `[${where}] interaksi ${interaction.id} sudah kedaluwarsa/dijawab proses lain. `
    + 'Cek apakah bot jalan dobel: `pm2 list` dan `ps aux | grep node`.',
  );
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.followUp({ ...EPHEMERAL, ...payload });
    return await interaction.reply({ ...EPHEMERAL, ...payload });
  } catch (err) {
    console.error('[reply] gagal:', err.message);
  }
}

async function sendPanel(interaction) {
  await interaction.deferReply(EPHEMERAL);
  try {
    await setSticky(interaction.channel);
    await interaction.editReply({
      content: '✅ Panel cek audio sudah dikirim dan **sticky aktif**: panel akan selalu pindah ke paling bawah channel ini.\nPakai `/panel-audio-stop` untuk mematikannya.',
    });
  } catch (err) {
    console.error('[panel] gagal kirim:', err.message);
    await interaction.editReply({
      content: '❌ Gagal mengirim panel. Pastikan bot punya izin **View Channel**, **Send Messages**, **Embed Links**, dan **Read Message History** di channel ini.',
    }).catch(() => {});
  }
}

async function stopPanel(interaction) {
  await interaction.deferReply(EPHEMERAL);
  const removed = await removeSticky(interaction.channel);
  await interaction.editReply({
    content: removed
      ? '🛑 Sticky dimatikan dan panel di channel ini sudah dihapus.'
      : 'ℹ️ Tidak ada panel sticky di channel ini.',
  });
}

async function runCheck(interaction, rawText) {
  const userId = interaction.user.id;
  const allIds = parseIds(rawText);

  if (!allIds.length) {
    return safeReply(interaction, {
      content: '❌ Tidak ada ID yang valid. Tempel ID audio berupa angka, contoh: `1837849285`.',
    });
  }

  if (running.has(userId)) {
    return safeReply(interaction, { content: '⏳ Pengecekan kamu sebelumnya masih berjalan, tunggu sebentar ya.' });
  }

  if (!isStaff(interaction)) {
    const until = cooldowns.get(userId) || 0;
    if (until > Date.now()) {
      return safeReply(interaction, {
        content: `⏳ Tunggu <t:${Math.ceil(until / 1000)}:R> sebelum cek lagi.`,
      });
    }
  }

  const ids = allIds.slice(0, config.maxIds);
  const skipped = allIds.length - ids.length;

  running.add(userId);
  try {
    await interaction.deferReply(config.resultEphemeral ? EPHEMERAL : {});

    // Update progress tanpa spam edit (maks tiap 1.5 detik), dan pastikan
    // edit progress tidak menimpa hasil akhir.
    let finished = false;
    let lastEdit = 0;
    let chain = Promise.resolve();
    const onProgress = (done, total) => {
      const now = Date.now();
      if (done < total && now - lastEdit < 1500) return;
      lastEdit = now;
      chain = chain.then(() => (finished ? null : interaction.editReply({
        content: `⏳ Mengecek audio... **${done}/${total}**`,
      }).catch(() => {})));
    };

    await interaction.editReply({ content: `⏳ Mengecek **${ids.length}** ID audio...` });
    const results = await checkMany(ids, onProgress);

    finished = true;
    await chain;

    const { embeds, followUps } = buildResults(results, { user: interaction.user, skipped });
    await interaction.editReply({ content: '', embeds });

    // Detail lanjutan kalau daftarnya panjang
    for (const embed of followUps) {
      await interaction.followUp({
        ...(config.resultEphemeral ? EPHEMERAL : {}),
        embeds: [embed],
      }).catch((err) => console.error('[check] followUp gagal:', err.message));
    }

    cooldowns.set(userId, Date.now() + config.cooldownSec * 1000);
  } catch (err) {
    if (isStaleInteraction(err)) return warnStale('check', interaction);
    console.error('[check] error:', err);
    try {
      await interaction.editReply({ content: '❌ Terjadi kesalahan saat mengecek. Coba lagi beberapa saat lagi.', embeds: [] });
    } catch { /* abaikan */ }
  } finally {
    running.delete(userId);
  }
}

async function handleInteraction(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel-audio') return await sendPanel(interaction);
      if (interaction.commandName === 'panel-audio-stop') return await stopPanel(interaction);
      if (interaction.commandName === 'cekaudio') {
        return await runCheck(interaction, interaction.options.getString('ids', true));
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === IDS.OPEN) return await interaction.showModal(buildModal());
      if (interaction.customId === IDS.HELP) return await interaction.reply({ ...EPHEMERAL, ...buildHelp() });
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === IDS.MODAL) {
      return await runCheck(interaction, interaction.fields.getTextInputValue(IDS.INPUT));
    }
  } catch (err) {
    if (isStaleInteraction(err)) return warnStale('interaction', interaction);
    console.error('[interaction] error:', err);
    await safeReply(interaction, { content: '❌ Terjadi kesalahan. Coba lagi.' });
  }
}

module.exports = { handleInteraction };
