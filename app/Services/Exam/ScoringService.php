<?php

namespace App\Services\Exam;

use App\Models\AttemptAnswer;
use App\Models\ExamAttempt;

/**
 * Menghitung skor: benar +points, salah -penalty, kosong 0 (nilai per soal).
 */
class ScoringService
{
    public function score(ExamAttempt $attempt): void
    {
        $attempt->loadMissing('sections');

        $answers = $attempt->answers()
            ->with(['question:id,question_group_id,points,penalty', 'question.group:id,exam_section_id', 'option:id,question_id,is_correct'])
            ->get();

        $perSection = [];

        foreach ($answers as $answer) {
            [$isCorrect, $score] = $this->scoreAnswer($answer);

            $answer->forceFill(['is_correct' => $isCorrect, 'score' => $score])->save();

            $sectionId = $answer->question->group->exam_section_id;
            $perSection[$sectionId] ??= ['score' => 0, 'correct' => 0, 'wrong' => 0];
            $perSection[$sectionId]['score'] += $score;
            $perSection[$sectionId]['correct'] += $isCorrect === true ? 1 : 0;
            $perSection[$sectionId]['wrong'] += $isCorrect === false ? 1 : 0;
        }

        $duration = 0;

        foreach ($attempt->sections as $attemptSection) {
            $stats = $perSection[$attemptSection->exam_section_id] ?? ['score' => 0, 'correct' => 0, 'wrong' => 0];

            $attemptSection->forceFill([
                'score' => $stats['score'],
                'correct_count' => $stats['correct'],
                'wrong_count' => $stats['wrong'],
            ])->save();

            if ($attemptSection->finished_at) {
                $duration += (int) $attemptSection->started_at->diffInSeconds($attemptSection->finished_at);
            }
        }

        $attempt->forceFill([
            'score_total' => array_sum(array_column($perSection, 'score')),
            'correct_count' => array_sum(array_column($perSection, 'correct')),
            'wrong_count' => array_sum(array_column($perSection, 'wrong')),
            'duration_seconds' => $duration,
        ])->save();
    }

    /**
     * @return array{0: bool|null, 1: int}
     */
    private function scoreAnswer(AttemptAnswer $answer): array
    {
        if (! $answer->option) {
            return [null, 0];
        }

        return $answer->option->is_correct
            ? [true, (int) $answer->question->points]
            : [false, -1 * (int) $answer->question->penalty];
    }
}
