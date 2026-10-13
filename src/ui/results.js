const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { STATUS } = require('../roblox/audioChecker');

const GROUPS = [
  { key: 'ok', title: '📋 ID yang bisa dipakai', emoji: '✅', statuses: [STATUS.PUBLIC] },
  { key: 'private', title: 'Private (hanya di game pemilik)', emoji: '🔒', statuses: [STATUS.PRIVATE] },
  { key: 'bad', title: 'Tidak bisa dipakai', emoji: '❌', statuses: [STATUS.NOT_AUDIO, STATUS.NOT_FOUND] },
  { key: 'err', title: 'Gagal dicek (coba lagi nanti)', emoji: '❔', statuses: [STATUS.ERROR] },
];

const COPY_ID = 'audiochk:copy';

const DETAIL_LIMIT = 3900; // batas aman deskripsi embed (maks 4096)
const FIELD_LIMIT = 1000; // batas aman value field (maks 1024)

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const clean = (s) => String(s || '').replace(/[`*_~|>]/g, '');

function lineFor(r, emoji) {
  const name = r.name ? ` · ${truncate(clean(r.name), 38)}` : '';
  const extra = [STATUS.PUBLIC, STATUS.PRIVATE].includes(r.status) ? '' : ` · _${clean(r.note)}_`;
  return `${emoji} \`${r.id}\`${name}${extra}`;
}

/** Hitung karakter embed sesuai aturan Discord (title, description, fields, footer, author). */
function embedLength(embed) {
  const d = embed.data;
  let n = (d.title?.length || 0) + (d.description?.length || 0)
    + (d.footer?.text?.length || 0) + (d.author?.name?.length || 0);
  for (const f of d.fields || []) n += f.name.length + f.value.length;
  return n;
}

/** Pecah baris-baris menjadi beberapa potongan teks dengan panjang maksimal `limit`. */
function chunkLines(lines, limit) {
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (current && current.length + line.length + 1 > limit) {
      chunks.push(current.trimEnd());
      current = '';
    }
    current += `${line}\n`;
  }
  if (current.trim()) chunks.push(current.trimEnd());
  return chunks;
}

/**
 * Semua hasil dalam 1 embed: ringkasan di atas, lalu detail per kelompok sebagai field.
 * Kalau daftarnya sangat panjang (melebihi batas Discord 6000 karakter / 25 field),
 * sisanya baru dikirim sebagai pesan lanjutan.
 *
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[], followUps: EmbedBuilder[] }}
 */
function buildResults(results, { user, skipped = 0 } = {}) {
  const groups = Object.fromEntries(GROUPS.map((g) => [g.key, results.filter((r) => g.statuses.includes(r.status))]));
  const okCount = groups.ok.length;

  const color = okCount === results.length ? config.colors.ok
    : okCount === 0 ? config.colors.bad
      : config.colors.warn;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎵 Hasil Cek Audio')
    .setDescription(`**${results.length}** ID dicek${user ? ` oleh ${user}` : ''}.`)
    .addFields(
      { name: '✅ Bisa', value: String(groups.ok.length), inline: true },
      { name: '🔒 Private', value: String(groups.private.length), inline: true },
      { name: '❌ Tidak bisa', value: String(groups.bad.length + groups.err.length), inline: true },
    );

  if (skipped > 0) {
    embed.addFields({
      name: '⚠️ Sebagian dilewati',
      value: `Maksimal ${config.maxIds} ID per cek. **${skipped}** ID sisanya belum dicek, kirim lagi di pengecekan berikutnya.`,
    });
  }

  // Detail per kelompok -> field (judul besar di baris pertama tiap kelompok)
  const detailFields = [];
  for (const g of GROUPS) {
    const list = groups[g.key];
    if (!list.length) continue;
    const chunks = chunkLines(list.map((r) => lineFor(r, g.emoji)), FIELD_LIMIT - g.title.length - 10);
    chunks.forEach((chunk, i) => {
      detailFields.push({ name: '\u200b', value: i === 0 ? `**${g.title}**\n${chunk}` : chunk });
    });
  }

  // Masukkan field selama masih muat di 1 embed
  const MAX_TOTAL = 5800;
  let used = embedLength(embed);
  let i = 0;
  for (; i < detailFields.length; i++) {
    const f = detailFields[i];
    const size = f.name.length + f.value.length;
    if ((embed.data.fields?.length || 0) >= 25 || used + size > MAX_TOTAL) break;
    embed.addFields(f);
    used += size;
  }

  // Sisa (jarang terjadi) -> pesan lanjutan
  const restLines = detailFields.slice(i).map((f) => f.value);
  const followUps = chunkLines(restLines, DETAIL_LIMIT).map((text) => new EmbedBuilder().setColor(color).setDescription(text));

  const components = okCount ? [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(COPY_ID).setLabel('Salin ID').setEmoji('📋').setStyle(ButtonStyle.Primary),
  )] : [];

  return { embeds: [embed], components, followUps };
}

/**
 * Ambil ID yang bisa dipakai langsung dari embed hasil (baris berawalan ✅),
 * jadi tombol tetap jalan walau bot sudah restart.
 */
function extractOkIds(message) {
  const text = (message?.embeds || [])
    .flatMap((e) => [e.description || '', ...(e.fields || []).map((f) => f.value)])
    .join('\n');
  const ids = [];
  for (const m of text.matchAll(/^✅ `(\d+)`/gm)) ids.push(m[1]);
  return [...new Set(ids)];
}

module.exports = { buildResults, extractOkIds, COPY_ID };
