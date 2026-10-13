const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../config');
const { STATUS } = require('../roblox/audioChecker');

const GROUPS = [
  { key: 'ok', title: '✅ Bisa diputar di semua map', emoji: '✅', statuses: [STATUS.PUBLIC] },
  { key: 'private', title: '🔒 Private (hanya di game pemilik)', emoji: '🔒', statuses: [STATUS.PRIVATE] },
  { key: 'bad', title: '❌ Tidak bisa dipakai', emoji: '❌', statuses: [STATUS.NOT_AUDIO, STATUS.NOT_FOUND] },
  { key: 'err', title: '❔ Gagal dicek (coba lagi nanti)', emoji: '❔', statuses: [STATUS.ERROR] },
];

const DETAIL_LIMIT = 3900; // batas aman deskripsi embed (maks 4096)

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const clean = (s) => String(s || '').replace(/[`*_~|>]/g, '');

function lineFor(r, emoji) {
  const name = r.name ? ` · ${truncate(clean(r.name), 38)}` : '';
  const extra = [STATUS.PUBLIC, STATUS.PRIVATE].includes(r.status) ? '' : ` · _${clean(r.note)}_`;
  return `${emoji} \`${r.id}\`${name}${extra}`;
}

function buildTextReport(results, groups) {
  const out = [`Hasil cek audio Roblox (${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB)`, ''];
  for (const g of GROUPS) {
    const list = groups[g.key];
    if (!list.length) continue;
    out.push(`== ${g.title.replace(/^\S+\s/, '')} (${list.length}) ==`);
    for (const r of list) {
      out.push(`${r.id} | ${r.name || '-'} | oleh ${r.creator || '-'} | ${r.note || ''}`);
    }
    out.push('');
  }
  return out.join('\n');
}

/**
 * @returns {{ embeds: EmbedBuilder[], files: AttachmentBuilder[] }}
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

  if (groups.ok.length) {
    const idsBlock = groups.ok.map((r) => r.id).join('\n');
    const block = `\`\`\`\n${idsBlock}\n\`\`\``;
    summary.addFields({
      name: '📋 ID yang bisa dipakai (siap salin)',
      value: block.length <= 1024 ? block : 'Terlalu panjang, lihat file `audio-bisa-dipakai.txt`.',
    });
  }

  if (skipped > 0) {
    summary.addFields({
      name: '⚠️ Sebagian dilewati',
      value: `Maksimal ${config.maxIds} ID per cek. **${skipped}** ID sisanya belum dicek, kirim lagi di pengecekan berikutnya.`,
    });
  }

  // Detail per ID
  const lines = [];
  for (const g of GROUPS) {
    const list = groups[g.key];
    if (!list.length) continue;
    lines.push(`**${g.title}**`);
    for (const r of list) lines.push(lineFor(r, g.emoji));
    lines.push('');
  }

  let detailText = '';
  for (const line of lines) {
    if (detailText.length + line.length + 1 > DETAIL_LIMIT) break;
    detailText += `${line}\n`;
  }
  if (detailText.length < lines.join('\n').length) {
    detailText += '\n_Daftar terpotong, detail lengkap ada di file `hasil-cek-audio.txt`._';
  }

  const detail = new EmbedBuilder().setColor(color).setDescription(detailText.trim() || '-');

  const files = [
    new AttachmentBuilder(Buffer.from(buildTextReport(results, groups), 'utf8'), { name: 'hasil-cek-audio.txt' }),
  ];
  if (groups.ok.length) {
    files.push(new AttachmentBuilder(Buffer.from(groups.ok.map((r) => r.id).join('\n'), 'utf8'), { name: 'audio-bisa-dipakai.txt' }));
  }

  return { embeds: [summary, detail], files };
}

module.exports = { buildResults };
