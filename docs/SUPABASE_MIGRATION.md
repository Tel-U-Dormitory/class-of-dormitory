# Migrasi CoD dari MySQL ke Supabase PostgreSQL

Status: persiapan kode. Database tujuan, kredensial, dan hasil verifikasi data
harus tersedia sebelum mengalihkan production. Jangan menjalankan test suite
Laravel pada database Supabase tujuan: tes menggunakan RefreshDatabase.

## Koneksi

Gunakan koneksi SQL Laravel/PDO; frontend Inertia dan autentikasi Laravel tetap
melalui aplikasi. Tidak perlu Supabase JS, mengganti autentikasi peserta, atau
menambahkan pooler pada VPS. Mulai dengan Supavisor session pooler (port 5432),
atau direct connection bila jaringan VPS mendukungnya. Jangan mengganti ke
transaction pooler tanpa memeriksa prepared statements dan fitur session.

Konfigurasi target:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=<session-pooler-host-dari-Connect>
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=<username-dari-Connect>
DB_PASSWORD=<diisi-melalui-penyimpanan-rahasia>
DB_SCHEMA=cod
DB_SSLMODE=require
```

Gunakan schema `cod` yang tidak diekspos di Data API, terpisah dari schema
Supabase `auth`, `storage`, dan aplikasi lain. Buat schema dan hak akses dengan
akun database yang berwenang setelah memeriksa database tujuan. Password tidak
boleh masuk Git, log, atau build context. `.env.supabase` lokal diabaikan Git.

## Urutan perpindahan

1. Verifikasi query baca dan transaksi tulis/rollback dari laptop ke Supabase.
   Verifikasi juga koneksi dari VPS; kedua jalur jaringan harus berfungsi.
2. Cadangkan konfigurasi production, MySQL dengan consistent snapshot, dan volume
   upload. Pertahankan APP_KEY, password/token hash, ID, dan nama volume storage.
3. Buat schema target dan jalankan migrasi Laravel menggunakan image baru yang
   memasang pdo_pgsql. Migrasi schema tidak berarti data telah dipindahkan.
4. Latih pemindahan seluruh tabel aplikasi ke target kosong. Pertahankan foreign
   key, null, JSON, boolean, timestamp, password hash, dan session. Selaraskan
   sequence PostgreSQL dengan ID maksimum setiap tabel. Jangan menyalin schema
   sistem Supabase atau menjalankan seeder pada target berisi data.
5. Bandingkan jumlah baris dan isi seluruh tabel secara deterministik; periksa
   relasi, hasil/nilai ujian, file media, serta kemampuan insert setelah reset
   sequence. Kesetaraan jumlah baris saja tidak cukup.
6. Saat cutover: aktifkan maintenance, hentikan scheduler dan semua penulis lain,
   lalu ambil snapshot final. Impor ulang snapshot final ke schema target kosong
   dan ulangi verifikasi. Hindari dua database yang menerima penulisan bersamaan.
7. Gunakan konfigurasi PostgreSQL pada app dan scheduler, kemudian recreate kedua
   container dengan image baru. `compose.supabase.yaml` mempertahankan proyek
   cod-production, alias cod-web, dan volume storage. Bangun ulang config cache.
8. Verifikasi login admin/peserta, monitor, media, submit/retry/perpindahan subtes,
   penilaian, dan scheduler dengan identitas uji. Buka maintenance setelah lulus.
9. Setelah tidak ada klien memakai MySQL lokal, hentikan proyek resora-mysql tanpa
   menghapus volume. Simpan backup dan konfigurasi lama untuk pemulihan.

Rollback ke MySQL sebelum membuka penulisan baru cukup mengembalikan image dan
konfigurasi lama serta menjalankan MySQL. Setelah target menerima penulisan baru,
rollback perlu menyelaraskan data baru terlebih dahulu; jangan langsung kembali
ke snapshot MySQL lama karena dapat menghilangkan jawaban.

## Anggaran VPS setelah MySQL dihentikan

Template memberi app 384 MiB RAM dan scheduler 128 MiB, dengan maksimum 12 worker
Apache dan keep-alive backend dimatikan. Cache/rate limiter memakai file pada
volume storage bersama; session database tetap dipertahankan. PDO PostgreSQL
mengirim SQL beserta parameter dalam satu panggilan tanpa PREPARE terpisah;
binding parameter tetap digunakan. Pada pengukuran VPS, query berparameter
sederhana turun dari sekitar 259 ms menjadi 86 ms dengan opsi tersebut.

Konfigurasi ini memberi app ruang sambil menyisakan kapasitas host untuk
kernel, Docker, SSH, dan reverse proxy. Limit container adalah plafon, bukan
reservasi dan bukan bukti kapasitas 170 peserta. Jangan menghapus semua limit
pada host sekitar 962 MiB atau menggunakan seluruh RAM untuk PHP. Batas worker
ini khusus template Supabase; template MySQL tetap memakai batas lama.

Ukur puncak memori, swap-in/out, waktu submit, tekanan CPU, koneksi database dan
latensi jaringan pada uji beban terpisah sebelum menaikkan worker/limit lagi.

## Alat snapshot operator

`scripts/db-snapshot.php` membaca koneksi Laravel aktif. Ia tidak menjalankan
migrasi schema atau seeder. Sediakan path absolut privat di luar direktori web
dan build context. Jangan tampilkan isi snapshot: terdapat data pribadi dan hash
kredensial. File ekspor dibuat dengan mode 0600 dan tidak ditimpa jika sudah ada.

```bash
# Koneksi aktif MySQL, consistent snapshot:
php scripts/db-snapshot.php export /private/cod-final.json

# Koneksi aktif PostgreSQL dan schema cod sudah dimigrasikan:
php scripts/db-snapshot.php import /private/cod-final.json
php scripts/db-snapshot.php verify /private/cod-final.json
```

Importer memeriksa checksum file, kesamaan tabel dan riwayat migrasi, menolak
tabel target yang sudah berisi data (selain riwayat migrasi), lalu memasukkan
data sesuai urutan foreign key dalam satu transaksi. Jumlah dan hash seluruh
isi baris dibandingkan sebelum commit; ID asli dipertahankan dan sequence
PostgreSQL diselaraskan. Pemeriksaan JSON membedakan object, array, boolean,
dan null. Timestamp dibandingkan dengan presisi mikrodetik.

Alat ini sengaja dibatasi untuk snapshot maksimal 16 MiB dan 100.000 baris per
tabel. Database produksi yang diperiksa pada 16 November 2026 memiliki 28 tabel,
dengan ukuran data dan indeks MySQL sekitar 1,3 MiB; batas tersebut diperiksa
saat ekspor. Jika melampaui batas, hentikan dan gunakan transport streaming.
Ekspor latihan bukan snapshot final: semua penulis harus dihentikan saat
mengambil snapshot yang akan dipakai untuk cutover.
