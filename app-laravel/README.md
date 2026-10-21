# Clash of Dormitory — Season 3 (Laravel + Inertia)

Platform seleksi kognitif antar-asrama: pendaftaran peserta, ujian 4 pilar dengan timer di server, dan panel panitia.

## Stack

- Laravel 12, Inertia v2, React 19 + TypeScript, Tailwind v4, shadcn/ui
- MySQL 8.4 (Docker `mysql`, database `cod_s3`; test memakai `cod_s3_testing`)
- PHP 8.5 dengan ekstensi `pdo_mysql`, `mbstring`, `intl`, `gd`, `zip`, `bcmath`, `curl`

## Menjalankan secara lokal

```bash
composer install && npm install
cp .env.example .env && php artisan key:generate
php artisan migrate:fresh --seed
composer run dev            # server Laravel + Vite + queue + log
php artisan schedule:work   # menutup pilar yang lewat tenggat walau peserta offline
```

Data demo (hanya `APP_ENV=local`) ada di `database/seeders/DatabaseSeeder.php`: akun admin/operator, 30 peserta, dan ujian contoh 19 soal.

Akun panitia untuk produksi: `php artisan cod:create-admin email@domain "Nama"` (tambahkan `--operator` untuk operator).

## Alur & aturan ujian

- Pilar berurutan Memory → Spatial → Numeric → Logic. Tiap pilar punya tenggat (`attempt_sections.deadline_at`) yang dihitung server; memuat ulang halaman tidak mengulang waktu.
- Selesai pilar (manual atau waktu habis) → jeda (`exams.break_seconds`, bisa dilewati) → pilar berikutnya. Pilar yang selesai terkunci.
- Grup soal bisa punya materi observasi (teks/gambar/video/flash) yang tampil **sekali**. Soal grup baru dikirim ke browser setelah observasi selesai, dan media observasi hanya bisa diunduh selama observasi berlangsung.
- Kunci jawaban tidak pernah dikirim ke browser. Skor: benar +poin, salah −penalti, kosong 0 (default +4/−1, bisa diubah per soal). Peringkat: skor tertinggi, lalu durasi tersingkat.
- Peserta login dengan NIM + token (token disimpan sebagai hash, ditampilkan sekali; admin bisa reset). Satu peserta hanya aktif di satu perangkat.

Inti logika ada di `app/Services/Exam/ExamEngine.php`, props yang boleh dilihat peserta di `ExamSessionPresenter.php`.

## Peran panitia

| Peran | Akses |
|---|---|
| Admin | Semua: ujian, bank soal, status peserta, reset token, hentikan/tambah waktu peserta |
| Operator | Dashboard, daftar & detail peserta, monitor live, hasil & ekspor CSV |

## Test

```bash
php artisan test
```
