# 🎵 KokoKrunch Audio Checker

Bot Discord untuk mengecek apakah ID boombox/audio Roblox **bisa diputar di semua map** (public) atau tidak. Bisa cek **banyak ID sekaligus** lewat panel atau slash command.

## Fitur
- **Panel** dengan tombol 🎵 Cek Audio (membuka form) dan ❓ Bantuan
- **Cek banyak ID sekaligus** (default maks. 50), format bebas: angka, `rbxassetid://...`, atau link Roblox; dipisah enter, spasi, atau koma. ID ganda otomatis dihapus
- Hasil dikelompokkan: ✅ bisa di semua map · 🔒 private · ❌ tidak bisa · ❔ gagal dicek
- Daftar **ID yang bisa dipakai siap salin** + file `.txt` laporan lengkap
- Progress real-time (`⏳ Mengecek 12/40...`), cache 30 menit, cooldown per member, retry otomatis kalau Roblox lambat / rate limit
- Tanpa database, cocok untuk VPS Node 20

## Cara kerja pengecekan
1. Ambil info aset dari `economy.roblox.com` → cek ID valid, tipe Audio, dan belum dihapus.
2. Coba ambil file audio lewat **Open Cloud Asset Delivery API** (`apis.roblox.com/asset-delivery-api/v1/assetId/{id}`):
   - berhasil → ✅ **public**, bisa diputar di semua map
   - ditolak (*not approved / not authorized*) → 🔒 **private**
3. Audio resmi Roblox selalu dianggap public.

## Setup

### 1. Buat API key Roblox (Open Cloud)
> ⚠️ **Penting:** buat API key dari **akun alt yang tidak punya audio dan bukan anggota grup mana pun**.
> Kalau API key dibuat dari akun/grup yang punya audio private, audio milik akun itu akan terbaca ✅ padahal di map lain tidak bisa diputar.

1. Login akun alt → buka https://create.roblox.com/dashboard/credentials
2. **Create API Key** → beri nama, misal `audio-checker`
3. Di **Access Permissions**, tambahkan API System **Legacy Assets / Asset Delivery** dengan izin baca (nama menu bisa sedikit berbeda, pilih yang berkaitan dengan asset delivery/read)
4. **Accepted IP Addresses**: isi IP VPS kamu (atau `0.0.0.0/0` untuk tes)
5. Simpan, lalu salin key ke `ROBLOX_API_KEY`

### 2. Bot Discord
1. https://discord.com/developers/applications → New Application → Bot → salin token
2. Invite bot dengan scope `bot` + `applications.commands`, izin: View Channel, Send Messages, Embed Links, Attach Files

### 3. Install & jalankan
```bash
cp .env.example .env      # isi DISCORD_TOKEN, CLIENT_ID, GUILD_ID, ROBLOX_API_KEY
npm install
npm run deploy            # daftarkan slash command
npm start
```

Tes pengecekan tanpa Discord (berguna untuk cek koneksi VPS ke Roblox):
```bash
npm run test:check -- 1837849285 9046863579
```

### 4. Jalankan 24/7 dengan pm2
```bash
pm2 start src/index.js --name audio-checker
pm2 save
```

## Command
| Command | Siapa | Fungsi |
|---|---|---|
| `/panel-audio` | Manage Server | Kirim panel cek audio ke channel |
| `/cekaudio ids:` | Semua | Cek langsung tanpa panel (pisahkan ID dengan spasi/koma) |

## Pengaturan `.env`
| Variabel | Default | Keterangan |
|---|---|---|
| `MAX_IDS` | 50 | Maksimal ID per cek (maks. 200) |
| `CONCURRENCY` | 3 | ID yang dicek bersamaan |
| `COOLDOWN_SECONDS` | 20 | Jeda per member (staff bebas cooldown) |
| `CACHE_MINUTES` | 30 | Lama hasil disimpan sementara |
| `RESULT_EPHEMERAL` | true | `false` = hasil terlihat semua orang |

## Troubleshooting
- **Semua hasil ❔ "Gagal ambil info (fetch failed)"** → VPS tidak bisa konek ke Roblox. Cek dengan `curl -I https://economy.roblox.com`. Kalau perlu pakai proxy, isi `ROBLOX_ECONOMY_BASE` / `ROBLOX_OPENCLOUD_BASE`.
- **"API key Roblox tidak valid"** → key salah, kedaluwarsa, atau IP VPS belum ditambahkan di Accepted IP Addresses.
- **Audio milik sendiri terbaca ✅** → API key dibuat dari akun pemilik audio. Ganti ke akun alt (lihat langkah 1).
- Roblox cukup sering mengubah API aset. Kalau tiba-tiba semua hasil berubah aneh, kabari untuk disesuaikan.
