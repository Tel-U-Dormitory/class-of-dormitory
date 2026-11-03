<?php

namespace Database\Seeders;

use App\Enums\ExamStatus;
use App\Enums\Pillar;
use App\Enums\StimulusType;
use App\Models\Exam;
use Illuminate\Database\Seeder;

/**
 * Soal contoh yang diporting dari supabase/dummy-questions.sql versi lama.
 * Format tiap soal: [teks, [opsi A-D], indeks kunci].
 */
class SampleExamSeeder extends Seeder
{
    public function run(): void
    {
        $exam = Exam::create([
            'title' => 'Seleksi Massal CoD Season 3',
            'description' => 'Ujian seleksi 4 pilar kognitif untuk menentukan cast Clash of Dormitory Season 3.',
            'status' => ExamStatus::Open,
            'scheduled_at' => now()->addDays(3)->setTime(8, 0),
            'break_seconds' => 300,
            'announcement' => 'Pastikan koneksi stabil dan gunakan laptop. Ujian tidak bisa diulang.',
        ]);

        foreach ($this->bank() as $i => [$pillar, $groups]) {
            $section = $exam->sections()->create([
                'pillar' => $pillar,
                'position' => $i + 1,
                'duration_seconds' => 30 * 60,
            ]);

            foreach ($groups as $g => $group) {
                $model = $section->groups()->create([
                    'title' => $group['title'],
                    'kind' => $group['kind'],
                    'position' => $g + 1,
                    'stimulus_type' => $group['stimulus'] ? StimulusType::Text : StimulusType::None,
                    'stimulus_text' => $group['stimulus'],
                    'stimulus_duration_seconds' => $group['stimulus'] ? 45 : null,
                ]);

                foreach ($group['questions'] as $q => [$body, $options, $correct]) {
                    $question = $model->questions()->create(['position' => $q + 1, 'body' => $body]);

                    foreach ($options as $o => $content) {
                        $question->options()->create(['position' => $o, 'content' => $content, 'is_correct' => $o === $correct]);
                    }
                }
            }
        }
    }

    private function bank(): array
    {
        return [
            [Pillar::Memory, [[
                'title' => 'Teks Aturan Asrama',
                'kind' => 'rules-text',
                'stimulus' => 'Pasal 1: Penghuni wajib mematuhi jam malam. Batas masuk asrama pada hari kerja (Senin–Jumat) adalah pukul 22.00 WIB. Pada hari libur (Sabtu–Minggu), batas masuk adalah pukul 23.30 WIB. Pelanggaran pertama dikenai teguran tertulis. Pelanggaran kedua dikenai denda Rp50.000. Pelanggaran ketiga berakibat pemanggilan orang tua.',
                'questions' => [
                    ['Berapa jam batas waktu masuk asrama pada hari kerja?', ['21.00 WIB', '22.00 WIB', '23.00 WIB', '23.30 WIB'], 1],
                    ['Berapa denda untuk pelanggaran kedua jam malam?', ['Rp25.000', 'Rp50.000', 'Rp75.000', 'Rp100.000'], 1],
                    ['Pada hari Sabtu, jam berapa batas masuk asrama?', ['22.00 WIB', '22.30 WIB', '23.00 WIB', '23.30 WIB'], 3],
                    ['Apa konsekuensi pelanggaran ketiga jam malam?', ['Denda Rp100.000', 'Skorsing 1 minggu', 'Pemanggilan orang tua', 'Dikeluarkan dari asrama'], 2],
                    ['Pelanggaran keberapa yang dikenai teguran tertulis?', ['Setiap pelanggaran', 'Pertama kali', 'Kedua kali', 'Ketiga kali'], 1],
                ],
            ]]],
            [Pillar::Spatial, [[
                'title' => 'Visualisasi Ruang',
                'kind' => 'block-count',
                'stimulus' => null,
                'questions' => [
                    ['Sebuah susunan kubus terdiri dari 3 kubus pada baris bawah dan 2 kubus di atasnya (di tengah). Berapa total kubus yang ada?', ['3', '4', '5', '6'], 2],
                    ['Sebuah kubus diletakkan di sudut ruangan sehingga menempel pada 2 dinding dan lantai. Berapa sisi yang masih terlihat?', ['1', '2', '3', '4'], 2],
                    ['Jaring-jaring berisi 6 persegi yang tersusun dalam 1 baris lurus. Ketika dilipat, bentuk apa yang terbentuk?', ['Kubus sempurna', 'Tidak bisa membentuk kubus', 'Prisma segitiga', 'Limas segiempat'], 1],
                    ['Huruf "R" dirotasi 180 derajat. Hasilnya paling mirip dengan…', ['Я', 'ᴚ (R terbalik atas-bawah dan kiri-kanan)', 'b', 'd'], 1],
                    ['Tampak atas bangunan balok menunjukkan susunan 4×3 kotak. Jika tinggi maksimalnya 2 lantai, berapa jumlah MAKSIMUM kubus?', ['12', '18', '24', '36'], 2],
                ],
            ]]],
            [Pillar::Numeric, [[
                'title' => 'Penalaran Angka',
                'kind' => 'number-series',
                'stimulus' => null,
                'questions' => [
                    ['Lanjutkan deret berikut: 2, 4, 8, 16, 32, …', ['48', '60', '64', '72'], 2],
                    ['Lanjutkan deret berikut: 1, 1, 2, 3, 5, 8, 13, …', ['18', '20', '21', '26'], 2],
                    ['Jika a ★ b = 2a + b, berapakah nilai 3 ★ 4?', ['7', '9', '10', '14'], 2],
                    ['P = 15² dan Q = 14 × 16. Pernyataan yang benar adalah…', ['P > Q', 'P < Q', 'P = Q', 'Tidak dapat ditentukan'], 0],
                    ['Kereta melaju 60 km/jam selama 2,5 jam, lalu 90 km/jam selama 1 jam. Berapa total jarak tempuhnya?', ['210 km', '225 km', '240 km', '270 km'], 2],
                ],
            ]]],
            [Pillar::Logic, [[
                'title' => 'Penalaran Logis',
                'kind' => 'syllogism',
                'stimulus' => null,
                'questions' => [
                    ['Premis 1: Semua mahasiswa asrama wajib mengikuti CoD. Premis 2: Budi adalah mahasiswa asrama. Kesimpulan yang valid adalah…', ['Budi mungkin mengikuti CoD', 'Budi tidak mengikuti CoD', 'Budi wajib mengikuti CoD', 'Tidak dapat disimpulkan'], 2],
                    ['Ani: "Budi yang mencuri." Budi: "Saya tidak mencuri." Cici: "Ani berbohong." Jika hanya satu orang yang jujur, siapa pencurinya?', ['Ani', 'Budi', 'Cici', 'Tidak dapat ditentukan'], 0],
                    ['Mulai dengan X = 10. Selama X > 5, kurangi X dengan 3. Berapa nilai akhir X?', ['1', '2', '4', '5'], 2],
                    ['Dalam suatu kode: ASRAMA = BTSBNB, GEDUNG = HFEVOH. Kode untuk kata UJIAN adalah…', ['VKJBO', 'TKIBO', 'VKIBO', 'TKJBO'], 0],
                ],
            ]]],
        ];
    }
}
