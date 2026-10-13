/**
 * Pengecekan audio Roblox.
 *
 * Alur per ID:
 *  1. Ambil info aset (economy API, tanpa login)  -> valid? tipe Audio? sudah dihapus?
 *  2. Coba ambil file audio lewat Open Cloud Asset Delivery (pakai API key)
 *       - berhasil (ada `location`)                -> PUBLIC  (bisa diputar di semua map)
 *       - ditolak "not approved / not authorized"  -> PRIVATE (hanya di game pemilik)
 *       - not found                                -> NOT_FOUND
 *  Audio resmi Roblox (creator user id 1) selalu public.
 */
const config = require('../config');

const STATUS = Object.freeze({
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  NOT_AUDIO: 'NOT_AUDIO',
  NOT_FOUND: 'NOT_FOUND',
  ERROR: 'ERROR',
});

const AUDIO_ASSET_TYPE_ID = 3;
const ROBLOX_OFFICIAL_USER_ID = 1;
const REQUEST_TIMEOUT_MS = 10_000;

const cache = new Map(); // id -> { result, expires }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(url, { headers = {}, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1200 * (attempt + 1) * (res.status === 429 ? 2 : 1);
        await sleep(Math.min(wait, 10_000));
        continue;
      }

      let body = null;
      try { body = await res.json(); } catch { /* bukan JSON */ }
      return { status: res.status, body };
    } catch (err) {
      if (attempt < retries) { await sleep(800 * (attempt + 1)); continue; }
      return { status: 0, body: null, error: err };
    }
  }
}

function errorMessage(body) {
  if (!body) return '';
  if (Array.isArray(body.errors) && body.errors[0]) return String(body.errors[0].message || '');
  return String(body.message || body.error || '');
}

async function getDetails(id) {
  const { status, body, error } = await request(`${config.urls.economy}/v2/assets/${id}/details`);
  if (status === 200 && body && body.AssetTypeId !== undefined) return { ok: true, details: body };
  if (status === 400 || status === 404) return { ok: false, notFound: true };
  return { ok: false, error: error ? error.message : `HTTP ${status}` };
}

async function getAccess(id) {
  if (!config.robloxApiKey) return { access: 'error', reason: 'ROBLOX_API_KEY belum diisi' };

  const { status, body, error } = await request(
    `${config.urls.openCloud}/asset-delivery-api/v1/assetId/${id}`,
    { headers: { 'x-api-key': config.robloxApiKey } },
  );

  const msg = errorMessage(body).toLowerCase();

  if (body && typeof body.location === 'string' && body.location) return { access: 'public' };
  if (status === 401) return { access: 'error', reason: 'API key Roblox tidak valid / kedaluwarsa' };
  if (msg.includes('not approved') || msg.includes('not authorized') || msg.includes('permission') || status === 403) {
    return { access: 'private' };
  }
  if (msg.includes('not found') || status === 404) return { access: 'notfound' };
  if (status === 0) return { access: 'error', reason: `Tidak bisa konek ke Roblox (${error?.message || 'timeout'})` };
  return { access: 'error', reason: msg || `HTTP ${status}` };
}

async function checkUncached(id) {
  const d = await getDetails(id);
  if (d.notFound) return { id, status: STATUS.NOT_FOUND, note: 'ID tidak ditemukan' };
  if (!d.ok) return { id, status: STATUS.ERROR, note: `Gagal ambil info (${d.error})` };

  const info = d.details;
  const creator = info.Creator || {};
  const base = {
    id,
    name: (info.Name || 'Tanpa nama').trim(),
    creator: creator.Name || '?',
    creatorType: creator.CreatorType || null,
  };

  if (/\[\s*content deleted\s*\]/i.test(base.name)) {
    return { ...base, status: STATUS.NOT_FOUND, note: 'Dihapus / kena moderasi' };
  }
  if (info.AssetTypeId !== AUDIO_ASSET_TYPE_ID) {
    return { ...base, status: STATUS.NOT_AUDIO, note: 'Bukan aset audio' };
  }
  if (creator.CreatorType === 'User' && Number(creator.CreatorTargetId) === ROBLOX_OFFICIAL_USER_ID) {
    return { ...base, status: STATUS.PUBLIC, note: 'Audio resmi Roblox' };
  }

  const a = await getAccess(id);
  switch (a.access) {
    case 'public': return { ...base, status: STATUS.PUBLIC, note: 'Public' };
    case 'private': return { ...base, status: STATUS.PRIVATE, note: 'Private, hanya di game pemilik' };
    case 'notfound': return { ...base, status: STATUS.NOT_FOUND, note: 'Dihapus / tidak tersedia' };
    default: return { ...base, status: STATUS.ERROR, note: a.reason || 'Gagal dicek' };
  }
}

async function checkOne(id) {
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.result;

  const result = await checkUncached(id);
  if (result.status !== STATUS.ERROR) {
    cache.set(id, { result, expires: Date.now() + config.cacheMinutes * 60_000 });
  }
  return result;
}

/** Cek banyak ID dengan batas concurrency. Urutan hasil = urutan input. */
async function checkMany(ids, onProgress) {
  const results = new Array(ids.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < ids.length) {
      const i = next++;
      try {
        results[i] = await checkOne(ids[i]);
      } catch (err) {
        results[i] = { id: ids[i], status: STATUS.ERROR, note: err.message || 'Error' };
      }
      done++;
      if (onProgress) onProgress(done, ids.length);
    }
  }

  const workers = Array.from({ length: Math.min(config.concurrency, ids.length) }, worker);
  await Promise.all(workers);
  return results;
}

/** Ambil ID dari teks bebas: angka biasa, rbxassetid://123, link roblox.com/library/123/... */
function parseIds(text) {
  const matches = String(text || '').match(/\d{5,20}/g) || [];
  return [...new Set(matches)];
}

// Bersihkan cache kedaluwarsa tiap 10 menit
setInterval(() => {
  const now = Date.now();
  for (const [id, v] of cache) if (v.expires <= now) cache.delete(id);
}, 10 * 60_000).unref();

module.exports = { STATUS, checkOne, checkMany, parseIds };
