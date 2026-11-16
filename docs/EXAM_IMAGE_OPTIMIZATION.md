# Optimasi gambar ujian

Perubahan lokal; tidak mengubah metode submit, timer observasi, atau aset production.

## Upload dan tampilan

- Soal, opsi dan slide memakai `ExamImageStorage`. PNG/JPEG dapat dikonversi ke WebP lossless sekali saat upload, hanya jika hasil lebih kecil. Tidak ada resize diagram.
- File asli disimpan privat pada subfolder `originals`. GIF/WebP dipertahankan; JPEG dengan EXIF dipertahankan agar orientasi tidak berubah. Maksimum gambar 12 megapiksel sebelum decode. GD tanpa WebP memakai file asli.
- Dockerfile menyertakan dukungan GD WebP; image Docker perlu dibangun ulang sebelum deploy nanti.
- Kegagalan transaksi membersihkan upload baru; penghapusan aset lama menunggu commit. Original arsip sengaja tidak dibersihkan otomatis.
- Peserta mendapatkan loading/error dan retry manual untuk soal, opsi, serta stimulus/slide. Pergantian URL mereset state. Tidak ada preload seluruh subtes atau retry otomatis tanpa batas.
- Admin mendapatkan preview file pilihan dan thumbnail gambar tersimpan. Preview sebelum simpan adalah sumber upload, bukan hasil WebP; thumbnail setelah simpan menggunakan aset hasil.

## Endpoint dan pengukuran

URL baru membawa `?attempt=ID`. Akses memvalidasi kepemilikan attempt dan gate section/observasi terbaru. URL lama masih kompatibel untuk halaman yang sudah terbuka. Jalur baru menghindari query pencarian ujian aktif global; query relasi lainnya dipertahankan sampai ada bukti pengukuran.

`EXAM_MEDIA_LOG_REQUESTS=true` mencatat durasi endpoint dan waktu database setelah middleware berjalan (bukan waktu sampai browser selesai render). Alasan penolakan gate dicatat sebagai `exam_media_denied`. Tidak mencatat jawaban, cookie atau token.

Bandingkan p50/p95 endpoint, database_ms, ukuran transfer dan waktu render browser dengan akun uji. Gunakan navigasi satu soal seperti frontend, jaringan lambat, reload, pergantian section, serta observasi. Jangan menganggap tes mengunduh seluruh gambar sekaligus setara browser.

## Offload opsional

Default `EXAM_MEDIA_ACCEL_REDIRECT=false`: Laravel tetap mengirim file. Untuk aktivasi kelak:

1. Mount volume storage aplikasi read-only pada container proxy ke `/var/www/html/storage`.
2. Masukkan `docker/nginx-exam-media.conf.example` ke server block Nginx yang sudah ada, periksa `nginx -t`, lalu reload.
3. Pastikan URL `/_exam-media/...` dari luar menghasilkan 404, sedangkan endpoint peserta yang sah menghasilkan gambar dengan MIME benar.
4. Aktifkan `EXAM_MEDIA_ACCEL_REDIRECT=true` dan refresh config aplikasi. Uji soal, opsi, stimulus, serta penolakan akses. Rollback dengan mengembalikan flag ke false.

Tidak ada perubahan compose/proxy production pada branch ini. Cache tetap `private, no-store`; cache izin peserta tidak ditambahkan. Cache metadata/browser ditunda sampai pengukuran menunjukkan kebutuhan dan kebijakan akses jelas.

## Audit dan gambar lama

Jalankan di lingkungan yang memang ingin diperiksa, bukan otomatis saat deploy:

```sh
php artisan exam:audit-media EXAM_ID
php artisan exam:optimize-images EXAM_ID
php artisan exam:optimize-images EXAM_ID --apply
```

Audit bersifat read-only, melaporkan file hilang/tidak valid, dimensi, byte, dan hash identik. Hash identik perlu dibandingkan dengan naskah, tidak otomatis salah.

Konversi default dry run. `--apply` hanya untuk draft tanpa attempt. Jalankan saat bank soal tidak sedang diedit, buat backup database/storage dahulu. Command menyimpan manifest path lama → baru di `exam-media/manifests/`, mempertahankan file lama, dan memperbarui referensi dalam transaksi. Untuk ujian historis, buat salinan bank soal terlebih dahulu; command ini tidak membuat salinan otomatis. Pemulihan memakai backup/manifest dengan pemeriksaan referensi; tidak ada penghapusan massal.

## Validasi lokal

Tes memakai SQLite in-memory, tidak memakai database aplikasi. Cakupan meliputi dimensi/asli/cleanup upload, rollback update admin, kepemilikan attempt, perpindahan ujian aktif dan section, attempt submitted, offload/path traversal, dry run serta penerapan konversi. Uji browser visual dan integrasi Nginx tetap harus dilakukan pada lingkungan uji sebelum deploy.
