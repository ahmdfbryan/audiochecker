/**
 * Sticky panel: panel cek audio selalu jadi pesan paling bawah di channel-nya.
 *
 * - Setiap ada pesan baru di channel panel, bot menunggu sebentar (debounce),
 *   lalu mengirim panel baru dan menghapus panel lama.
 * - Data channel + ID panel disimpan di data/sticky.json supaya tetap jalan setelah restart.
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { buildPanel } = require('./ui/panel');

const FILE = path.join(__dirname, '..', 'data', 'sticky.json');

let state = {}; // channelId -> { guildId, messageId }
const timers = new Map(); // channelId -> timeout
const busy = new Set(); // channelId yang sedang repost

function load() {
  try {
    state = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
  } catch {
    state = {};
  }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('[sticky] gagal simpan data:', err.message);
  }
}

load();

async function deleteMessageSafe(channel, messageId) {
  if (!messageId) return;
  try {
    await channel.messages.delete(messageId);
  } catch (err) {
    if (err.code !== 10008) console.warn('[sticky] gagal hapus panel lama:', err.message); // 10008 = sudah terhapus
  }
}

/** Kirim panel baru dulu, baru hapus yang lama, supaya panel tidak pernah hilang. */
async function postPanel(channel) {
  const oldId = state[channel.id]?.messageId;
  const msg = await channel.send(buildPanel(channel.guild));
  state[channel.id] = { guildId: channel.guildId, messageId: msg.id };
  save();
  await deleteMessageSafe(channel, oldId);
  return msg;
}

function schedule(client, channelId) {
  clearTimeout(timers.get(channelId));
  timers.set(channelId, setTimeout(() => {
    timers.delete(channelId);
    repost(client, channelId);
  }, config.stickyDelaySec * 1000));
}

async function repost(client, channelId) {
  if (busy.has(channelId)) return schedule(client, channelId);
  busy.add(channelId);
  try {
    const record = state[channelId];
    if (!record) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.warn(`[sticky] channel ${channelId} tidak ditemukan, sticky dinonaktifkan.`);
      delete state[channelId];
      save();
      return;
    }

    // Kalau panel sudah paling bawah, tidak perlu kirim ulang
    const last = await channel.messages.fetch({ limit: 1 }).then((c) => c.first()).catch(() => null);
    if (last && last.id === record.messageId) return;

    await postPanel(channel);
  } catch (err) {
    console.error('[sticky] gagal kirim ulang panel:', err.message);
  } finally {
    busy.delete(channelId);
  }
}

/** Dipanggil dari event messageCreate. */
function onMessage(message) {
  const record = state[message.channelId];
  if (!record || message.id === record.messageId) return;
  schedule(message.client, message.channelId);
}

/** Dipanggil saat bot online: pastikan semua panel sticky ada di paling bawah. */
async function restoreAll(client) {
  for (const channelId of Object.keys(state)) {
    await repost(client, channelId);
  }
}

/** Aktifkan sticky di channel ini (atau pindahkan panel ke paling bawah). */
async function setSticky(channel) {
  clearTimeout(timers.get(channel.id));
  return postPanel(channel);
}

/** Matikan sticky dan hapus panel di channel ini. */
async function removeSticky(channel) {
  const record = state[channel.id];
  if (!record) return false;
  clearTimeout(timers.get(channel.id));
  timers.delete(channel.id);
  delete state[channel.id];
  save();
  await deleteMessageSafe(channel, record.messageId);
  return true;
}

module.exports = { onMessage, restoreAll, setSticky, removeSticky };
