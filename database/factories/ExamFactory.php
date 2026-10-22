<?php

namespace Database\Factories;

use App\Enums\ExamStatus;
use App\Enums\Pillar;
use App\Enums\StimulusType;
use App\Models\Exam;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Exam>
 */
class ExamFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => 'Seleksi '.fake()->words(2, true),
            'status' => ExamStatus::Open,
            'break_seconds' => 300,
        ];
    }

    /**
     * Ujian lengkap: 4 pilar, masing-masing berisi grup soal berpilihan ganda.
     * Pilar Memory memakai grup observasi teks.
     */
    public function withQuestions(int $perSection = 3, int $sectionSeconds = 1800): static
    {
        return $this->afterCreating(function (Exam $exam) use ($perSection, $sectionSeconds) {
            foreach (Pillar::cases() as $i => $pillar) {
                $section = $exam->sections()->create([
                    'pillar' => $pillar,
                    'position' => $i + 1,
                    'duration_seconds' => $sectionSeconds,
                ]);

                $group = $section->groups()->create([
                    'title' => $pillar->label().' 1',
                    'position' => 1,
                    'stimulus_type' => $pillar === Pillar::Memory ? StimulusType::Text : StimulusType::None,
                    'stimulus_text' => $pillar === Pillar::Memory ? 'Hafalkan: kode gedung adalah 7.' : null,
                    'stimulus_duration_seconds' => $pillar === Pillar::Memory ? 30 : null,
                ]);

                foreach (range(1, $perSection) as $n) {
                    $question = $group->questions()->create([
                        'position' => $n,
                        'body' => "Soal {$pillar->label()} nomor {$n}",
                    ]);

                    foreach (['A', 'B', 'C', 'D'] as $p => $label) {
                        $question->options()->create([
                            'position' => $p,
                            'content' => "Opsi {$label}",
                            'is_correct' => $p === 0,
                        ]);
                    }
                }
            }
        });
    }
}
