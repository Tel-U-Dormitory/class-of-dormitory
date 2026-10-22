# Clash of Dormitory — Season 3 (Laravel + Inertia)

Platform seleksi kognitif antar-asrama: pendaftaran peserta, ujian 4 pilar dengan timer di server, dan panel panitia.

## Stack

- Laravel 12, Inertia v2, React 19 + TypeScript, Tailwind v4, shadcn/ui
- MySQL 8.4 (Docker `mysql`, database `cod_s3`; test memakai `cod_s3_testing`)
- PHP 8.5 dengan ekstensi `pdo_mysql`, `mbstring`, `intl`, `gd`, `zip`, `bcmath`, `curl`

## Menjalankan dari clone baru

Semua perintah dijalankan dari root repository; folder `app-laravel/` sudah dipindahkan ke root.
Siapkan PHP 8.4+ (sesuai CI; `composer.json` mensyaratkan minimal 8.2), Composer 2,
Node.js 22, npm, dan MySQL 8.4. Aktifkan ekstensi PHP `pdo_mysql`, `mbstring`,
`intl`, `gd`, `zip`, `bcmath`, `curl`, `dom`, dan `xml`.

```bash
git clone git@github.com:Tel-U-Dormitory/class-of-dormitory.git
cd class-of-dormitory
git checkout laravel-rewrite
cp .env.example .env
composer install
npm ci
php artisan key:generate
```

Buat database lokal melalui akun MySQL yang memiliki izin membuat database:

```sql
CREATE DATABASE IF NOT EXISTS cod_s3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cod_s3_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Sesuaikan `DB_HOST`, `DB_PORT`, `DB_USERNAME`, dan `DB_PASSWORD` di `.env`.
Gunakan `DB_DATABASE=cod_s3`. Akun tersebut juga harus bisa mengakses
`cod_s3_testing`, yang digunakan secara terpisah oleh test. `.env` tidak ikut Git;
jangan masukkan kredensial sungguhan ke `.env.example`.

```bash
php artisan migrate --seed
php artisan storage:link
npm run build
composer run dev
```

Buka [http://localhost:8000](http://localhost:8000). Jalankan scheduler di terminal terpisah:

```bash
php artisan schedule:work
```

Data demo (hanya lingkungan `local`/`testing`) dibuat oleh `DatabaseSeeder`:

| Peran | Login | Password/token |
|---|---|---|
| Admin | admin@cod.test | password |
| Operator | operator@cod.test | password |
| Peserta | NIM 13520001–13520030 | TEST-TOKN |

Seed demo dijalankan sekali pada database kosong. Untuk mengulang demo, gunakan
`php artisan migrate:fresh --seed` **hanya pada database lokal yang boleh dihapus**.
Foto peserta, unggahan media, database lokal, cache, dan dependency tidak ikut repository.
SSR dinonaktifkan di template environment; alur lokal cukup memakai Vite.

Setelah menarik perubahan developer lain:

```bash
composer install
npm ci
php artisan migrate
php artisan optimize:clear
npm run build
```

Pertahankan `composer.lock` dan `package-lock.json` di Git agar versi dependency konsisten.
Akun panitia untuk produksi: `php artisan cod:create-admin email@domain "Nama"`
(tambahkan `--operator` untuk operator).

## Alur & aturan ujian

- Pilar berurutan Memory → Spatial → Numeric → Logic. Tiap pilar punya tenggat (`attempt_sections.deadline_at`) yang dihitung server; memuat ulang halaman tidak mengulang waktu.
- Selesai pilar (manual atau waktu habis) → jeda (`exams.break_seconds`, bisa dilewati) → pilar berikutnya. Pilar yang selesai terkunci.
- Grup soal bisa punya materi observasi (teks/gambar/video/flash) yang tampil **sekali**. Soal grup baru dikirim ke browser setelah observasi selesai, dan media observasi hanya bisa diunduh selama observasi berlangsung.
- Kunci jawaban tidak pernah dikirim ke browser. Skor: benar +poin, salah −penalti, kosong 0 (default +4/−1, bisa diubah per soal). Peringkat: skor tertinggi, lalu durasi tersingkat.
- Peserta login dengan NIM + token (token disimpan sebagai hash, ditampilkan sekali; admin bisa reset). Satu peserta hanya aktif di satu perangkat.

Inti logika ada di `app/Services/Exam/ExamEngine.php`, props yang boleh dilihat peserta di `ExamSessionPresenter.php`.

## Setelah seleksi: cast, challenge, bracket

- **Penetapan cast** (halaman Hasil → *Tetapkan cast*): Top 4 global di-keep, lalu 4 besar tiap gedung dari sisanya (`config/exam.php` → `cast`). Peserta didiskualifikasi tidak diperingkat. Penanda *spesialis* rahasia per pilar juga diatur di sini.
- **Cast reveal** (`/admin/ujian/{id}/cast-reveal`): panggung layar penuh dengan urutan dan suara seperti versi lama. Spasi = mulai, ← → = ganti gedung, R = ulang.
- **Challenge** (`/admin/challenge`): game per chapter, tipe *Numerical Odyssey*, keypad angka, sandi teks, atau pilihan ganda; mode individu atau kelompok; deathmatch. Waktu tempuh dihitung server sejak game dibuka. Papan peringkat diperbarui otomatis.
- **Kiosk** (`/arena/{kode}`): layar game di panggung, **hanya bisa dibuka panitia yang login**. Peserta memilih namanya lalu menjawab; penilaian di server. Numerical Odyssey boleh dicoba ulang sampai benar; game sekali-jawab hanya menampilkan "terkirim".
- **Roster**: jika tidak ada undangan khusus, roster berisi peserta berstatus Cast/Lolos/Deathmatch (game deathmatch: hanya Deathmatch).
- **Bracket**: dari halaman challenge, N tercepat yang benar → *Lolos babak*, sisa roster → *Deathmatch* atau *Tereliminasi*. Ubah manual di `/admin/bracket`.

Data demo lokal (`DemoResultsSeeder`) mensimulasikan 25 peserta mengerjakan ujian lewat engine asli, menetapkan cast, dan membuat dua contoh challenge.

## Peran panitia

| Peran | Akses |
|---|---|
| Admin | Semua: ujian, bank soal, status peserta, reset token, hentikan/tambah waktu peserta |
| Operator | Dashboard, daftar & detail peserta, monitor live, hasil & ekspor CSV, cast reveal, bracket (lihat), layar kiosk |

## Kapasitas & deploy

Uji beban lokal (`scripts/loadtest.mjs`, 150 peserta login → mulai → observasi → menjawab terus, server PHP 8 worker + MySQL di laptop 12 core):

| Skenario | Jawaban/detik | p95 simpan jawaban | Error |
|---|---|---|---|
| Jeda pikir ~2 dtk (±10× beban nyata) | 62 | 73 ms | 0 |
| Jeda pikir ~0,4 dtk (±40× beban nyata) | 243 | 292 ms | 0 |
| 150 peserta habis waktu bersamaan (`exam:sync-attempts`) | — | 6,8 dtk untuk semua | 0 |

Beban nyata 150 peserta hanya sekitar 5–8 request/detik, jadi VPS kecil sudah cukup.

**Rekomendasi server:** 2 vCPU, 2–4 GB RAM, Nginx + PHP-FPM 8.3+ (`pm.max_children` ±16), MySQL 8, HTTPS.

Checklist produksi:

1. `.env`: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://…`, kredensial DB, `SESSION_SECURE_COOKIE=true`. Disarankan `CACHE_STORE=redis` (atau `file`) agar rate limiter tidak menulis ke MySQL tiap request.
2. `composer install --no-dev -o`, `npm ci && npm run build`, `php artisan migrate --force`, `php artisan db:seed --class=BuildingSeeder`, `php artisan optimize`.
3. **Wajib:** cron `* * * * * php /path/artisan schedule:run` agar pilar peserta yang offline tetap ditutup dan dinilai saat waktu habis.
4. Folder `storage/` harus bisa ditulis; backup database **dan** `storage/app/private` (foto peserta, media soal) sebelum dan sesudah ujian.
5. Buat akun panitia: `php artisan cod:create-admin email@domain "Nama"`.
6. Sebelum hari H, jalankan uji beban terhadap server sungguhan:

   ```bash
   php artisan tinker --execute='foreach (range(1,150) as $i) App\Models\Participant::factory()->create(["nim" => sprintf("1359%04d", $i)]);'
   BASE=https://domain-kamu USERS=150 DURATION=60 node scripts/loadtest.mjs
   ```

   Lalu hapus peserta uji (`nim` diawali 1359) dan attempt-nya.

## Pemeriksaan sebelum push

```bash
composer validate --strict --no-check-publish
composer check-platform-reqs
npm run build
php artisan test
git diff --check
```

Test memakai MySQL `cod_s3_testing` sesuai `phpunit.xml`; trait `RefreshDatabase`
akan membangun ulang tabel di database pengujian. Jangan arahkan database test ke data produksi.
Jika muncul `SQLSTATE[HY000] [2002]`, periksa layanan MySQL, host/port, dan kredensial `.env`.
Jika konfigurasi lama masih tersimpan, jalankan `php artisan config:clear`.

GitHub Actions menjalankan instalasi dependency dari lockfile, build frontend, dan test
menggunakan layanan MySQL 8.4 pada setiap push dan pull request. Pastikan job `checks`
hijau sebelum menggabungkan perubahan. `npm run lint` dan `npm run format` mengubah file;
gunakan hanya ketika memang ingin memperbaiki lint/format.

## Catatan dependency untuk pengembang berikutnya

Verifikasi 22 Oktober 2026: instalasi dari kedua lockfile, lint, build, migrasi/seed,
dan 75 test (304 assertion) berhasil pada salinan bersih menggunakan database MySQL terpisah.
`npm audit` saat verifikasi melaporkan 33 temuan (2 critical, 22 high, 6 moderate,
3 low), termasuk `form-data` dan `shell-quote` pada dependency transitif.
Jalankan `npm audit` untuk detail terbaru dan prioritaskan pembaruan dependency
beserta pengujian ulang sebelum deployment produksi.
