# Diagnosis dan optimasi performa navigasi

Tanggal: 20 November 2026. Sumber: `feature/section-score-adjustment` pada `44eef1c`, dibandingkan dengan merge-base `main` (`54ab8b8`). Perbaikan: `fix/navigation-and-results-performance`.

## Kesimpulan

Branch menambah fitur penyesuaian nilai dan review jawaban melalui tiga commit: `b0fd66f`, `7ec3d1d`, dan `44eef1c`. Ada 13 file berubah, 1.378 baris ditambah dan 16 dihapus. Tidak ada perubahan dependensi, konfigurasi Vite, atau entry point aplikasi pada branch tersebut. Jadi penambahan fitur ini tidak membuat semua halaman mengunduh seluruh kode review: aplikasi sudah memakai dynamic page imports.

Regresi lintas halaman yang nyata ada di `CastSelectionService::ranked()`: relasi `sections.adjuster` ditambahkan ke query bersama. Query ini juga dipanggil beranda, halaman cast publik, reveal admin, penetapan cast, dan pemeriksaan akses foto cast. Beranda sebelumnya bahkan mengambil seluruh ranking hanya untuk boolean `castOpen`. Setelah publikasi hasil, pekerjaan tersebut berjalan setiap beranda dibuka. Ini adalah jalur kode yang dapat menambah beban server untuk user publik juga, bukan hanya admin hasil.

Temuan ini berasal dari penelusuran kode, build produksi, dan pengujian terisolasi. Belum ada pengukuran latency/CPU/database dari deployment, sehingga tidak mengklaim seluruh kelambatan produksi disebabkan branch ini atau menjanjikan latency nol.

## Audit seluruh perubahan branch sumber

| File | Perubahan dan penilaian |
| --- | --- |
| `app/Http/Controllers/Admin/ParticipantController.php` | Menambah ID ujian dan tiga atribut nilai pada riwayat peserta. Relasi sudah eager-loaded sebelumnya; tidak menambah query per subtes. Payload bertambah sesuai riwayat peserta. |
| `app/Http/Controllers/Admin/ResultController.php` | Menambah metadata koreksi untuk seluruh peserta dan endpoint review. Hasil tidak dipaginasi; review memuat semua subtes, soal, opsi, dan jawaban sebelum merespons. Ini menahan navigasi dan memperbesar payload. |
| `app/Models/AttemptSection.php` | Kolom/cast penyesuaian, relasi admin, dan perhitungan nilai akhir. Relasi tidak otomatis diambil dari model; biaya berasal dari caller yang memuatnya. |
| `app/Services/Exam/CastSelectionService.php` | `sections` menjadi `sections.adjuster`. Tambahan eager query admin dan hidrasi relasi memengaruhi seluruh caller ranking, termasuk publik. Bukan N+1 karena sudah eager-loaded. |
| `app/Services/Exam/ScoringService.php` | Menjaga nilai web dan koreksi saat penilaian ulang; transaksi koreksi memperbarui total. Berjalan saat scoring/koreksi, bukan setiap navigasi. Tidak diubah oleh optimasi ini. |
| `database/migrations/2026_11_19_235358_add_manual_adjustment_to_attempt_sections_table.php` | Menambah kolom dan backfill nilai web sekali ketika migrasi. Tidak menjalankan backfill pada tiap request. |
| `resources/js/components/admin/adjust-score-dialog.tsx` | Form koreksi; hanya dimount ketika dialog dibuka. Tidak ada polling atau loop efek yang terbukti sebagai penyebab umum. |
| `resources/js/pages/admin/exams/results.tsx` | Menambah tombol/modal per subtes dan link review pada tabel semua peserta. Jumlah DOM dan payload tumbuh dengan peserta × subtes. |
| `resources/js/pages/admin/exams/review.tsx` | Halaman baru 530 baris. Merender semua soal subtes aktif sekaligus, gambar tanpa lazy loading, dan pencarian `some`/`findIndex` berulang yang membuat filtering/penomoran kuadratik. Mengimpor MathText yang sebelumnya langsung membawa KaTeX. |
| `resources/js/pages/admin/participants/show.tsx` | Ringkasan nilai koreksi dan link review pada riwayat peserta. Tidak menambah polling/global render. |
| `routes/admin.php` | Menambah route GET review dan PATCH koreksi. Tidak menambah pekerjaan pada route lain. |
| `tests/Feature/Exam/SectionScoreAdjustmentTest.php` | Uji perilaku fitur, tidak ikut runtime web. |
| `eslint.config.js` | Penyesuaian lint, tidak memengaruhi runtime web. |

## Implementasi

- Query ranking bersama hanya mengambil peserta/gedung. Detail subtes hanya dimuat oleh hasil/ekspor; relasi admin penyesuai hanya diperlukan di review.
- `hasRanked()` memakai filter kelayakan yang sama dengan ranking, tetapi mengeksekusi satu `exists()` untuk beranda. Tidak menghidrasi seluruh cohort.
- Hasil dan review memakai `Inertia::defer()` dan komponen `Deferred` dengan skeleton. Query soal/jawaban tidak berjalan pada respons awal review. Mekanisme ini mengikuti [protokol deferred props Inertia v2](https://inertiacore.net/docs/v2/core-concepts/the-protocol/).
- Hasil dibatasi 50 peserta per halaman. Peringkat global, peringkat gedung, dan preview cast dihitung sebelum filter/paginasi. Detail subtes diambil hanya untuk halaman aktif. CSV tetap memuat seluruh peserta.
- Metadata admin/tanggal koreksi yang tidak digunakan tabel dihapus dari payload tabel. Review tetap menampilkan audit koreksi.
- Review awalnya merender maksimal 20 soal, dengan tombol menambah 20 berikutnya. Filter/subtes baru mengembalikan batas ke 20. Semua soal tetap dapat diperiksa.
- Pencarian ID dan nomor soal memakai Set/Map, sehingga tidak melakukan pencarian linear di dalam setiap loop soal. Gambar review memakai `loading="lazy"` dan `decoding="async"`.
- MathText memuat renderer KaTeX melalui `React.lazy` hanya jika ada soal LaTeX. Teks biasa tidak menunggu library rumus.
- Layout admin dan publik menampilkan skeleton segera saat navigasi GET penuh dimulai. Sidebar/header tetap terlihat. Konten sebelumnya disembunyikan, tetap mounted sampai transisi selesai, sehingga kegagalan request tidak menghapus state form. Submit, polling, deferred request, prefetch, dan partial reload tidak memicu skeleton navigasi ini. Layout sesi ujian tidak diubah.
- Link hasil dan review melakukan prefetch saat hover, mengikuti mekanisme navigasi yang sudah digunakan sidebar.

## Bukti dan validasi

- Build awal: chunk MathText + KaTeX 259,38 KB, gzip 78,17 KB. Setelah dipisah: wrapper MathText sekitar 0,54 KB, gzip 0,33 KB; renderer sekitar 259,41 KB baru diunduh saat diperlukan. Ini pengurangan dependensi awal untuk halaman soal tanpa LaTeX, bukan pengurangan seluruh ukuran aplikasi.
- Payload hasil dibatasi 50 baris; misalnya 1.000 peserta sebelumnya mengirim 1.000 detail, sekarang maksimal 50 (95% lebih sedikit baris per respons data). Cohort global masih dibaca untuk menjaga aturan ranking/cast; ini bukan klaim query ranking sudah O(1).
- Uji regresi membuktikan halaman kedua dari 55 peserta berisi 5 peserta dengan rank global/gedung mulai 51, dan skor subtes tetap tersedia.
- Uji membuktikan initial review tidak melakukan SELECT soal/opsi/jawaban, lalu deferred request mengembalikan subtes dan jawaban benar yang sama.
- Uji membuktikan pemeriksaan ketersediaan cast menggunakan satu query `exists` dan menolak attempt didiskualifikasi.
- 14 uji terarah (penyesuaian nilai, pemilihan cast, efisiensi runtime): **lulus, 142 assertions** pada PHP 8.4 dan SQLite memory.
- Pemeriksaan TypeScript, ESLint file yang diubah, format PHP, dan build produksi: lulus.
- Seluruh suite: 114 tests, 491 assertions; 106 lulus dan 8 error karena PHP 8.4 lokal tidak memiliki ekstensi GD untuk membuat gambar uji. PHP default 8.5 memiliki GD tetapi driver SQLite lokalnya tidak tersedia. Error tersebut terjadi pada fixture gambar, bukan assertion fitur optimasi.

Perintah uji backend terisolasi (tidak memakai database aplikasi):

```bash
DB_CONNECTION=sqlite DB_DATABASE=:memory: DB_URL='' php8.4 vendor/bin/phpunit --filter='SectionScoreAdjustmentTest|CastSelectionTest|RuntimeEfficiencyTest'
```

## Batas dan pemeriksaan setelah deployment

Skeleton memberi respons visual segera, sementara URL dan konten tujuan tetap mengikuti respons server Inertia. Jaringan, autentikasi, dan query ringan masih membutuhkan waktu. First visit juga masih memerlukan download entry bundle. Tidak ada klaim perpindahan halaman benar-benar membutuhkan 0 ms.

Review masih mengambil seluruh dataset soal melalui deferred request agar perpindahan tab/filter lokal langsung bekerja; render awalnya dibatasi. Jika ukuran bank soal menjadi sangat besar, ukur payload deferred dan pertimbangkan pagination/fetch per subtes dengan skeleton per tab.

Di deployment, bandingkan TTFB/p95 dan ukuran response pada beranda (hasil sudah dipublikasikan), hasil dengan banyak peserta, dan review bergambar. Periksa juga latensi koneksi database, jumlah worker PHP, cache/session driver, OPcache, dan apakah mode production benar-benar memakai build Vite. Data tersebut belum diakses atau diubah dalam pekerjaan lokal ini. Tidak menambah cache ranking yang berisiko menampilkan nilai lama setelah koreksi.
