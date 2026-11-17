# Optimasi runtime ujian

## Perubahan aplikasi

1. Media soal, pilihan, stimulus dan slide mengambil metadata, kepemilikan attempt,
   status, section aktif dan waktu observasi dalam satu SELECT untuk URL yang
   menyertakan `attempt`. Izin tidak di-cache. URL lama tetap didukung melalui
   resolver attempt. Query autentikasi/session berada di luar hitungan SELECT ini.
2. Transfer file dapat ditangani Nginx melalui `X-Accel-Redirect` setelah Laravel
   meloloskan izin. Fitur ini tetap opt-in, bukan akses publik ke storage.
3. Contoh environment production memakai session file pada volume storage yang
   persisten. APP_KEY dan volume harus tetap sama ketika container diperbarui.
   Pergantian driver dari database membuat pengguna perlu login kembali.
4. `exam:sync-attempts` memilih hanya attempt yang deadline section beserta grace
   period, atau akhir jedanya sudah lewat. Engine tetap memeriksa ulang status dan
   deadline di dalam transaksi sebelum transisi, termasuk peserta offline.
5. Heartbeat memakai snapshot section yang sudah dimuat. Heartbeat biasa tidak
   mengunci attempt; hanya transisi yang jatuh tempo memakai sync terkunci.
   Penulisan last_seen diberi jarak minimal 15 detik melalui UPDATE bersyarat.
   Status, section dan deadline tetap dibaca pada setiap heartbeat, sehingga
   penambahan waktu dan penghentian admin tetap terlihat.

Algoritma penilaian, checkpoint jawaban, aturan observasi, single-session dan
frekuensi heartbeat frontend tidak diubah. Tidak ada migrasi schema baru.

## Mengaktifkan offload di instalasi NPM yang sudah ada

Lakukan dalam maintenance ketika tidak ada ujian aktif. Pull image sebelum downtime.

1. Pertahankan nama project dan volume aplikasi. Periksa nama volume storage nyata
   dengan `docker inspect`, jangan membuat volume kosong pengganti.
2. Tambahkan volume tersebut sebagai external volume pada Compose NPM dan mount
   read-only ke `/var/www/html/storage`. Pertahankan port, network, TLS dan limit
   worker yang sudah berjalan. Contoh deklarasi (nama volume harus diverifikasi):

   ```yaml
   services:
     nginx-proxy-manager:
       volumes:
         - cod_storage:/var/www/html/storage:ro
   volumes:
     cod_storage:
       external: true
       name: cod-production_storage
   ```

3. Masukkan isi `docker/nginx-exam-media.conf.example` ke Advanced milik **host
   CoD** di NPM. Jangan menaruhnya di location publik atau mengganti server block.
   Periksa izin baca file oleh worker NPM. Tidak perlu mengubah upload menjadi
   publik, memindahkan file, atau mengunggah ulang gambar.
4. Validasi Compose, recreate NPM untuk mount baru, lalu jalankan `nginx -t`.
   Pastikan konfigurasi tersimpan melalui pengaturan host NPM agar regenerasi
   konfigurasi tidak menghilangkannya. Upstream lama yang tidak ada harus
   dinonaktifkan terlebih dahulu, dengan konfigurasi deployment tetap disimpan.
5. Setelah mount/location siap, set `.env.production`:

   ```dotenv
   SESSION_DRIVER=file
   EXAM_MEDIA_ACCEL_REDIRECT=true
   ```

6. Ganti referensi image aplikasi dan jalankan `sudo bash scripts/deploy.sh -f
   compose.yaml` dari direktori deployment. Script hanya menjalankan migration
   yang belum diterapkan; tidak menggunakan fresh/reset atau menghapus volume.
7. Verifikasi login, pergantian sesi, logout, heartbeat dan scheduler; bandingkan
   isi file media melalui HTTPS dengan file storage. URL internal harus 404 saat
   dibuka langsung, attempt milik orang lain harus ditolak, dan aturan observasi
   harus tetap berlaku. Periksa log NPM/Laravel dan restart/OOM container.

Rollback offload: set `EXAM_MEDIA_ACCEL_REDIRECT=false` dan recreate aplikasi agar
config cache diperbarui. Laravel kembali mengirim file dengan pemeriksaan izin
yang sama. Pergantian session driver juga membutuhkan login ulang. Simpan image
sebelumnya untuk rollback kode; jangan rollback database atau menghapus volume.

## Validasi dan batas penilaian kapasitas

`RuntimeEfficiencyTest` memeriksa jumlah query media, heartbeat tanpa transisi,
perubahan deadline, transisi deadline/jeda, seleksi scheduler dan persistensi
session file. Regresi media memeriksa ownership, status, section, traversal dan
header offload. CI menjalankan seluruh suite pada MySQL dan PostgreSQL serta
smoke test image production.

Optimasi ini mengurangi penggunaan PHP dan perjalanan ke database eksternal.
Ini bukan bukti kapasitas 110 peserta pada 1 CPU/1 GB. Batas tersebut memerlukan
load test dengan pola media, heartbeat, checkpoint dan submit serentak yang
mewakili ujian; amati latency p95/p99, error, CPU/RAM, antrean PHP dan pool DB.
