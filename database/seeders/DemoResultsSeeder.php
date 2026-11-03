<?php

namespace Database\Seeders;

use App\Enums\ChallengeStatus;
use App\Enums\GameType;
use App\Models\Challenge;
use App\Models\Exam;
use App\Models\Participant;
use App\Services\Exam\CastSelectionService;
use App\Services\Exam\ExamEngine;
use Illuminate\Database\Seeder;

/**
 * Data demo lokal: mensimulasikan peserta mengerjakan ujian lewat ExamEngine asli,
 * menetapkan cast, dan membuat contoh challenge. Peserta 13520001–13520005 dibiarkan
 * belum ujian agar alur peserta tetap bisa dicoba.
 */
class DemoResultsSeeder extends Seeder
{
    public function run(ExamEngine $engine, CastSelectionService $cast): void
    {
        $exam = Exam::with('sections.groups.questions.options')->latest('id')->firstOrFail();

        Participant::where('nim', '>', '13520005')->orderBy('nim')->get()->each(function (Participant $participant, int $i) use ($engine, $exam) {
            $attempt = $engine->start($participant, $exam);
            $skill = 0.35 + ($i % 7) * 0.09;

            foreach ($exam->sections as $section) {
                foreach ($section->groups as $group) {
                    if ($group->requiresObservation()) {
                        $engine->startObservation($attempt, $group);
                        $engine->finishObservation($attempt, $group);
                    }

                    foreach ($group->questions as $question) {
                        if (mt_rand(1, 100) <= 15) {
                            continue;
                        }

                        $option = mt_rand(1, 100) <= $skill * 100
                            ? $question->options->firstWhere('is_correct', true)
                            : $question->options->where('is_correct', false)->random();

                        $engine->answer($attempt, $question, $option->id);
                    }
                }

                $attempt = $engine->finishCurrentSection($attempt);

                if (! $attempt->isSubmitted()) {
                    $attempt = $engine->skipBreak($attempt);
                }
            }

            // Variasi durasi agar urutan seri bisa dibedakan.
            $attempt->update(['duration_seconds' => 1800 + $i * 37]);
        });

        $cast->apply($exam);

        Challenge::create([
            'code' => 'numerical_odyssey',
            'title' => 'Numerical Odyssey',
            'description' => 'Susun rumus dari angka 1–6 yang menghasilkan 24.',
            'chapter' => 1,
            'game_type' => GameType::NumericalOdyssey,
            'answer_key' => '24',
            'max_winners' => 5,
            'max_attempts' => null,
            'status' => ChallengeStatus::Locked,
        ]);

        Challenge::create([
            'code' => 'ch1_dm',
            'title' => 'Sandi Gedung',
            'description' => 'Pecahkan sandi yang ditampilkan di layar panggung.',
            'chapter' => 1,
            'game_type' => GameType::TextCode,
            'is_deathmatch' => true,
            'answer_key' => 'ASRAMA JAYA',
            'max_winners' => 2,
            'max_attempts' => 1,
            'status' => ChallengeStatus::Locked,
        ]);
    }
}
