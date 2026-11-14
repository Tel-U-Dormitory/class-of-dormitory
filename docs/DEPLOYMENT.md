# Deploy production CoD ke Resora

Panduan ini memakai image GHCR, Docker Compose, MySQL 8.4, dan reverse proxy HTTPS
yang dikelola operator. Server tidak memerlukan Git, Composer, Node, atau source code.
Jalankan perintah server dengan Bash dari direktori deployment yang sama.

## 1. Yang sudah disiapkan di repository

- PR ke `main`: validasi Composer, ESLint tanpa mengubah file, build Vite, test PHP
  dengan MySQL terisolasi, build image amd64, serta smoke test HTTP `/up`.
- Push ke `main` (termasuk merge): pemeriksaan yang sama, lalu publish image
  `ghcr.io/tel-u-dormitory/class-of-dormitory:sha-<full-commit-sha>`.
- Image publish mendukung `linux/amd64` dan `linux/arm64`. Smoke test runtime CI
  berjalan pada amd64; verifikasi runtime arm64 dilakukan saat deploy jika dipakai.
- Hanya job `publish` memiliki `packages: write`. PR tidak login/publish ke registry.
- Artifact `cod-deployment` berisi `cod-deployment.tar.gz`: Compose production,
  opsi MySQL baru, template environment, panduan ini, dan `IMAGE.txt` berisi digest.
- PHP 8.4 + Apache + OPcache melayani hanya direktori `public`; asset Vite ikut image.
- Service `scheduler` menjalankan `exam:sync-attempts` tiap menit, termasuk untuk
  peserta offline. Jangan jalankan scheduler tambahan dari cron host.
- Volume `storage` menyimpan upload privat/public dan maintenance state. Cache
  konfigurasi dan view dibangun saat container dimulai, bukan saat image dibangun.
- Tidak ada migrasi atau seed otomatis ketika container restart.
- Tidak ada worker queue karena aplikasi saat ini tidak mendispatch queued jobs;
  template memakai `QUEUE_CONNECTION=sync`. Tambahkan worker sebelum memakai queue.

Kapasitas 170 peserta belum tervalidasi. Tidak ada limit CPU/RAM yang dipaksakan
berdasarkan tebakan; ukur kapasitas production sebelum ujian.

## 2. Manual developer: aktifkan pipeline GitHub

1. Commit perubahan ini, push branch, lalu buat PR ke `main`.
2. Di repository **Settings → Actions → General**, pastikan Actions yang dipakai
   workflow diizinkan oleh kebijakan organisasi. Workflow memakai `GITHUB_TOKEN`
   otomatis; tidak perlu menambahkan PAT sebagai secret CI.
3. Tunggu workflow **checks** lulus. Jadikan job **test** dan **image** required
   status checks pada ruleset/branch protection `main` setelah nama check muncul.
   Wajibkan PR untuk perubahan ke `main`; job publish tidak dijadikan required PR check.
4. Merge PR. Buka run pada commit `main`; pastikan job **publish** berhasil.
5. Periksa package `class-of-dormitory` di organisasi. Jika package sudah ada dan
   publish ditolak, beri repository ini akses write melalui pengaturan package
   **Manage Actions access**, sesuai kebijakan organisasi.
6. Tentukan package public atau private. Private memerlukan akun server yang punya
   akses baca package dan token classic `read:packages`; otorisasi SSO jika diwajibkan.
7. Unduh artifact **cod-deployment** dari run tersebut, ekstrak ZIP artifact di laptop,
   lalu salin `cod-deployment.tar.gz` ke server memakai SCP/SFTP.

Workflow bisa dijalankan ulang melalui **Run workflow** pada `main`. Deploy tidak
otomatis dipicu dari GitHub dan tidak memerlukan SSH key server di GitHub.

## 3. Manual developer: siapkan direktori dan environment server

Contoh lokasi `/opt/cod`; operator harus memiliki izin menulis direktori tersebut.
Jangan memakai direktori project Compose lain yang sedang aktif.

```bash
mkdir -p /opt/cod
cd /opt/cod
# Salin cod-deployment.tar.gz ke direktori ini terlebih dahulu.
tar -xzf cod-deployment.tar.gz
cp .env.production.example .env.production
chmod 600 .env.production
```

Perintah `cp` hanya untuk deploy pertama. Pada update, pertahankan `.env.production`.
Arsip tidak berisi secret dan tidak menimpa `.env.production` yang sudah ada.
Isi memakai editor lokal server:

- `COD_IMAGE`: isi persis referensi digest dari `IMAGE.txt` (direkomendasikan), atau
  tag SHA dari run. Jangan memakai `latest` sebagai satu-satunya referensi versi.
- `APP_URL`: domain production HTTPS yang sebenarnya.
- `APP_KEY`: key baru untuk instalasi baru; pertahankan key lama jika migrasi aplikasi
  yang sudah beroperasi. Jangan mengganti key setiap deployment.
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`: database production.
- `TRUSTED_PROXIES`: IP/CIDR reverse proxy sebagaimana terlihat dari container.
- `MAIL_*`: SMTP jika password reset/email diperlukan. Default `log` tidak mengirim
  email dan menuliskan pesan ke log; batasi akses log atau konfigurasikan SMTP.

Generate key tanpa menampilkan secret lain; salin hasilnya ke `APP_KEY`:

```bash
docker run --rm --entrypoint php IMAGE_DARI_IMAGE_TXT -r 'echo "base64:".base64_encode(random_bytes(32)).PHP_EOL;'
```

Ganti `IMAGE_DARI_IMAGE_TXT` dengan referensi nyata. Jika package private, lakukan
login sebelum perintah ini. Untuk login interaktif gunakan `docker login ghcr.io -u
USERNAME_GITHUB`, lalu masukkan token saat diminta password. Jangan menaruh token di
argumen command, file Git, atau membagikannya. Docker menyimpan kredensial akun ini;
gunakan credential helper bila tersedia dan batasi akses akun deployment.

### Pilih database yang benar

**A. Database production sudah tersedia** — gunakan hanya Compose utama:

```bash
dc() { docker compose --env-file .env.production -f compose.production.yaml "$@"; }
```

`DB_HOST=127.0.0.1` di dalam container menunjuk container itu sendiri. Jika MySQL
berjalan pada host Resora, gunakan `host.docker.internal`, atur bind address/firewall
dan grant akun MySQL agar menerima koneksi jaringan Docker yang diperlukan.
Jika database berada di server lain, gunakan hostname/IP yang dapat dijangkau dari
container. Jika MySQL sudah berada dalam Compose lain, siapkan jaringan eksternal
bersama atau endpoint yang sesuai; hostname service Compose lain tidak otomatis dikenal.
Gunakan akun khusus CoD dan jangan membuka port database ke internet.

**B. Membuat database production BARU di Compose** — isi `DB_HOST=mysql`,
`DB_USERNAME=cod` (bukan root), `DB_PASSWORD`, dan `MYSQL_ROOT_PASSWORD` yang kuat
dan berbeda. Gunakan dua file pada SEMUA operasi, termasuk update/rollback:

```bash
dc() { docker compose --env-file .env.production -f compose.production.yaml -f compose.mysql.yaml "$@"; }
dc up -d mysql
dc ps
```

Tunggu MySQL healthy. Tidak ada port MySQL yang dipublikasikan ke host. Variabel
inisialisasi MySQL hanya berlaku untuk volume kosong; mengganti password di file
environment tidak mengubah password database yang sudah diinisialisasi.
Jangan memakai opsi B sebagai pengganti database lama tanpa rencana migrasi data.

Definisikan ulang fungsi `dc` yang dipilih setiap membuka sesi SSH baru. Selalu
gunakan direktori dan project name yang sama (`cod-production`).

## 4. Manual developer: deploy pertama

```bash
dc config --quiet
dc pull
```

Jalankan langkah berikutnya hanya jika perintah sebelumnya berhasil (exit code 0).
Jika menyalin satu blok sebagai skrip, gunakan `set -e` agar kegagalan menghentikan
skrip. Jangan meneruskan migrasi/start/pembukaan maintenance setelah error.

Jika ada data lama, backup dan pindahkan database serta SEMUA isi `storage/app`,
termasuk `storage/app/private` berisi foto peserta dan media soal. Volume baru kosong
tidak otomatis menyalin upload lama. Pertahankan `APP_KEY` dan uji restore terlebih dahulu.
Setelah import, sesuaikan kepemilikan file dalam volume agar dapat dibaca/ditulis
`www-data` (UID 33). Jangan mengarahkan dua instance ujian ke database yang sama.

Jalankan migrasi dan data referensi (bukan data demo):

```bash
dc run --rm --no-deps app php artisan migrate --force
dc run --rm --no-deps app php artisan db:seed --class=BuildingSeeder --force
dc run --rm --no-deps app php artisan cod:create-admin admin@DOMAIN_ANDA "Admin CoD"
dc up -d app scheduler
dc ps
dc logs --tail=100 app scheduler
curl --fail http://127.0.0.1:8080/up
```

Ganti email admin; password diminta interaktif. Tambahkan `--operator` untuk akun
operator. Jika mengubah `APP_PORT`, sesuaikan URL curl. `up -d` belum membuktikan
aplikasi siap: pastikan app **healthy**, scheduler tetap running, dan cek log.

## 5. Manual developer: reverse proxy dan HTTPS

Compose mempublikasikan aplikasi ke `127.0.0.1:8080` secara default. Reverse proxy
yang berjalan pada host meneruskan trafik HTTPS ke endpoint ini. Pasang sertifikat
dengan mekanisme yang sudah digunakan Resora. Contoh blok Nginx untuk virtual host
yang SUDAH memiliki konfigurasi HTTPS:

```nginx
client_max_body_size 24m;
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Sesuaikan dengan proxy yang benar-benar dipakai. Jika proxy berada dalam container,
loopback proxy bukan host Resora; hubungkan ke jaringan Docker aplikasi dan arahkan
ke `app:80`, lalu gunakan IP/CIDR jaringan proxy tersebut sebagai trusted proxy.
Jangan memperluas bind port ke seluruh interface tanpa kebutuhan dan firewall.

Amati IP sumber proxy di access log `dc logs app`, isi `TRUSTED_PROXIES` sesuai IP/CIDR
tersebut, lalu `dc up -d --force-recreate app scheduler` setelah mengubah environment.
Jangan percaya semua proxy pada jaringan yang menerima koneksi langsung tidak tepercaya.
Pastikan proxy mengganti forwarded headers dari klien dengan nilai yang benar.

Verifikasi `https://DOMAIN_ANDA/up`, halaman login, asset CSS/JS, URL HTTPS, login
admin/peserta, upload dan akses media privat, simpan jawaban, timer, serta submit.
Cookie secure membutuhkan HTTPS; pengujian login via HTTP loopback bukan uji login
production. `/up` memeriksa aplikasi boot, bukan koneksi database atau scheduler.
Periksa tambahan:

```bash
dc exec --user www-data app php artisan migrate:status
dc exec --user www-data app php artisan schedule:list
dc logs --since=5m scheduler
```

Uji penutupan ujian peserta offline pada ujian percobaan, lalu uji beban pola ujian
170 peserta sebelum go-live. Jangan melakukan uji beban pada ujian aktif.

## 6. Manual developer: backup dan update berikutnya

Jadwalkan deployment di luar ujian aktif. Backup database dan semua upload sebagai
satu pasangan konsisten, salin backup keluar server, serta uji restore. Untuk MySQL
Compose, contoh backup database saat aplikasi tidak menerima penulisan:

```bash
backup_dir="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
chmod 700 backups "$backup_dir"
dc exec --user www-data app php artisan down --retry=60
dc stop scheduler
dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -u "$MYSQL_USER" --single-transaction --no-tablespaces "$MYSQL_DATABASE"' > "$backup_dir/database.sql"
dc run --rm --no-deps --entrypoint tar app -czf - -C /var/www/html/storage app > "$backup_dir/uploads.tar.gz"
chmod 600 "$backup_dir"/*
```

Untuk database eksternal, gunakan backup/snapshot resmi layanan tersebut sebagai
pengganti command `mysqldump` di atas. Jika backup gagal, hentikan update; pulihkan
layanan lama dengan `dc start scheduler` dan `dc exec --user www-data app php artisan up`.
Backup environment/APP_KEY melalui penyimpanan secret yang aman secara terpisah.

Urutan update (maintenance dan scheduler sudah dihentikan seperti di atas):

1. Simpan referensi image aktif dan salinan konfigurasi deployment lama untuk rollback.
2. Unduh artifact dari run commit baru yang sukses. Ekstrak ke direktori deployment;
   pertahankan `.env.production` dan tinjau perubahan template/Compose/panduan.
3. Ubah `COD_IMAGE` ke digest baru dari `IMAGE.txt`; sesuaikan variabel baru jika ada.
4. Jalankan:

```bash
dc config --quiet
dc pull
dc run --rm --no-deps app php artisan migrate --force
dc up -d --force-recreate app scheduler
dc ps
dc logs --tail=100 app scheduler
dc exec --user www-data app php artisan up
curl --fail https://DOMAIN_ANDA/up
```

Pastikan app healthy sebelum membuka maintenance. Scheduler otomatis melewati
task saat maintenance. Jika ada kegagalan, jangan lanjutkan pembukaan maintenance
sebelum penyebabnya jelas atau rollback selesai. Compose ini tidak menjamin zero downtime.

## 7. Manual developer: rollback

Jika tidak ada perubahan database yang tidak kompatibel:

1. Aktifkan maintenance dan hentikan scheduler.
2. Pulihkan Compose/config versi sebelumnya, pertahankan secret, lalu kembalikan
   `COD_IMAGE` ke digest sebelumnya.
3. Jalankan `dc config --quiet`, `dc pull`, dan
   `dc up -d --force-recreate app scheduler`.
4. Pastikan app healthy, periksa log dan fungsi aplikasi, lalu jalankan
   `dc exec --user www-data app php artisan up`.

Rollback image tidak membatalkan migrasi. Jika migrasi tidak kompatibel, ikuti
rencana restore database/upload dari backup konsisten dengan konsekuensi hilangnya
data setelah backup. Jangan otomatis menjalankan `migrate:rollback`, `migrate:fresh`,
atau seed demo pada production. Jangan menjalankan `docker compose down -v` karena
menghapus volume data. Simpan image/digest versi sebelumnya selama periode rollback.

## Referensi

- GitHub Actions / GHCR: https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
- Compose production: https://docs.docker.com/compose/how-tos/production/
- Laravel deployment: https://laravel.com/docs/12.x/deployment
- Trusted proxies: https://laravel.com/docs/12.x/requests#configuring-trusted-proxies
- Scheduler: https://laravel.com/docs/12.x/scheduling
