const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { STATUS } = require('../roblox/audioChecker');

const GROUPS = [
  { key: 'ok', title: 'Bisa diputar di semua map', emoji: '✅', statuses: [STATUS.PUBLIC] },
  { key: 'private', title: 'Private (hanya di game pemilik)', emoji: '🔒', statuses: [STATUS.PRIVATE] },
  { key: 'bad', title: 'Tidak bisa dipakai', emoji: '❌', statuses: [STATUS.NOT_AUDIO, STATUS.NOT_FOUND] },
  { key: 'err', title: 'Gagal dicek (coba lagi nanti)', emoji: '❔', statuses: [STATUS.ERROR] },
];

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
 * @returns {{ embeds: EmbedBuilder[], followUps: EmbedBuilder[] }}
 *   embeds    -> dikirim di balasan utama (ringkasan + detail halaman 1)
 *   followUps -> detail lanjutan kalau daftarnya panjang (1 embed per pesan)
 */
function buildResults(results, { user, skipped = 0 } = {}) {
  const groups = Object.fromEntries(GROUPS.map((g) => [g.key, results.filter((r) => g.statuses.includes(r.status))]));
  const okCount = groups.ok.length;

  const color = okCount === results.length ? config.colors.ok
    : okCount === 0 ? config.colors.bad
      : config.colors.warn;

  const summary = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎵 Hasil Cek Audio')
    .setDescription(`**${results.length}** ID dicek${user ? ` oleh ${user}` : ''}.`)
    .addFields(
      { name: '✅ Bisa', value: String(groups.ok.length), inline: true },
      { name: '🔒 Private', value: String(groups.private.length), inline: true },
      { name: '❌ Tidak bisa', value: String(groups.bad.length + groups.err.length), inline: true },
    )
    .setTimestamp();

  // ID yang bisa dipakai, siap salin (dipecah jadi beberapa field kalau panjang)
  if (groups.ok.length) {
    const idChunks = chunkLines(groups.ok.map((r) => r.id), FIELD_LIMIT - 10);
    idChunks.slice(0, 3).forEach((chunk, i) => {
      summary.addFields({
        name: i === 0 ? '📋 ID yang bisa dipakai (siap salin)' : '​',
        value: `\`\`\`\n${chunk}\n\`\`\``,
      });
    });
    if (idChunks.length > 3) {
      summary.addFields({ name: '​', value: '_Daftar lengkap ada di bagian **Bisa diputar di semua map** di bawah._' });
    }
  }

  if (skipped > 0) {
    summary.addFields({
      name: '⚠️ Sebagian dilewati',
      value: `Maksimal ${config.maxIds} ID per cek. **${skipped}** ID sisanya belum dicek, kirim lagi di pengecekan berikutnya.`,
    });
  }

  // Detail per ID, dipecah per halaman
  const lines = [];
  for (const g of GROUPS) {
    const list = groups[g.key];
    if (!list.length) continue;
    if (lines.length) lines.push('');
    lines.push(`## ${g.title}`);
    for (const r of list) lines.push(lineFor(r, g.emoji));
  }

  const pages = chunkLines(lines, DETAIL_LIMIT);
  const detailEmbeds = pages.map((text, i) => {
    const e = new EmbedBuilder().setColor(color).setDescription(text);
    if (pages.length > 1) e.setFooter({ text: `Detail ${i + 1}/${pages.length}` });
    return e;
  });

  // Discord membatasi total 6000 karakter untuk semua embed dalam satu pesan.
  // Kalau ringkasan + detail pertama terlalu panjang, detail pertama ikut dikirim terpisah.
  const fitsTogether = detailEmbeds.length
    && embedLength(summary) + embedLength(detailEmbeds[0]) <= 5800;

  return fitsTogether
    ? { embeds: [summary, detailEmbeds[0]], followUps: detailEmbeds.slice(1) }
    : { embeds: [summary], followUps: detailEmbeds };
}

module.exports = { buildResults };
