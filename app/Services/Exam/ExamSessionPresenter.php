<?php

namespace App\Services\Exam;

use App\Enums\AttemptStatus;
use App\Enums\StimulusType;
use App\Models\AttemptObservation;
use App\Models\ExamAttempt;
use App\Models\Question;
use App\Models\QuestionGroup;
use App\Models\QuestionOption;
use Carbon\CarbonImmutable;

/**
 * Menyusun props halaman sesi ujian. Kunci jawaban tidak pernah ikut terkirim,
 * dan isi soal di grup observasi baru dikirim setelah observasinya selesai.
 */
class ExamSessionPresenter
{
    public function present(ExamAttempt $attempt): array
    {
        $attempt->load(['exam.sections', 'sections', 'currentSection']);
        $now = CarbonImmutable::now();

        $attemptSections = $attempt->sections->keyBy('exam_section_id');

        $sections = $attempt->exam->sections->map(function ($section) use ($attempt, $attemptSections) {
            $attemptSection = $attemptSections->get($section->id);

            $state = match (true) {
                $attemptSection?->isFinished() => 'done',
                $section->id === $attempt->current_section_id => $attempt->status === AttemptStatus::OnBreak ? 'next' : 'current',
                default => 'upcoming',
            };

            return [
                'id' => $section->id,
                'pillar' => $section->pillar->value,
                'label' => $section->label(),
                'duration_seconds' => $section->duration_seconds,
                'state' => $state,
            ];
        })->values();

        return [
            'attempt' => [
                'id' => $attempt->id,
                'status' => $attempt->status->value,
            ],
            'exam' => [
                'title' => $attempt->exam->title,
            ],
            'serverNow' => $now->getTimestampMs(),
            'sections' => $sections,
            'current' => $attempt->status === AttemptStatus::InProgress ? $this->currentSection($attempt, $now) : null,
            'break' => $attempt->status === AttemptStatus::OnBreak ? [
                'ends_at' => $attempt->break_ends_at->getTimestampMs(),
                'next_section' => $sections->firstWhere('id', $attempt->current_section_id),
            ] : null,
        ];
    }

    private function currentSection(ExamAttempt $attempt, CarbonImmutable $now): ?array
    {
        $attemptSection = $attempt->sections->firstWhere('exam_section_id', $attempt->current_section_id);

        if (! $attemptSection) {
            return null;
        }

        $section = $attempt->currentSection;
        $groups = $section->groups()
            ->with(['questions' => fn ($q) => $q->active()->with('options')])
            ->get()
            ->filter(fn (QuestionGroup $group) => $group->questions->isNotEmpty());

        $observations = $attempt->observations()->get()->keyBy('question_group_id');
        $answers = $attempt->answers()->pluck('question_option_id', 'question_id');

        $number = 0;

        $presentedGroups = $groups->map(function (QuestionGroup $group) use ($observations, $now, &$number) {
            $observation = $observations->get($group->id);
            $observationState = $this->observationState($group, $observation, $now);
            $revealQuestions = $observationState === 'none' || $observationState === 'done';

            return [
                'id' => $group->id,
                'title' => $group->title,
                'stimulus_type' => $group->stimulus_type->value,
                'observation' => [
                    'state' => $observationState,
                    'duration_seconds' => $group->observationSeconds(),
                    'ends_at' => $observationState === 'active' ? $observation->ends_at->getTimestampMs() : null,
                ],
                'stimulus' => $observationState === 'active' ? $this->stimulus($group) : null,
                'questions' => $group->questions->map(function (Question $question) use ($revealQuestions, &$number) {
                    $number++;

                    return $revealQuestions
                        ? $this->question($question, $number)
                        : ['id' => $question->id, 'number' => $number, 'locked' => true];
                })->values(),
            ];
        })->values();

        return [
            'section_id' => $section->id,
            'pillar' => $section->pillar->value,
            'label' => $section->label(),
            'instructions' => $section->instructions,
            'deadline_at' => $attemptSection->deadline_at->getTimestampMs(),
            'groups' => $presentedGroups,
            'answers' => $answers,
            'question_count' => $number,
        ];
    }

    private function observationState(QuestionGroup $group, ?AttemptObservation $observation, CarbonImmutable $now): string
    {
        if (! $group->requiresObservation()) {
            return 'none';
        }

        if (! $observation) {
            return 'pending';
        }

        return $observation->isActive($now) ? 'active' : 'done';
    }

    private function stimulus(QuestionGroup $group): array
    {
        return [
            'text' => $group->stimulus_type === StimulusType::Text ? $group->stimulus_text : null,
            'media_url' => in_array($group->stimulus_type, [StimulusType::Image, StimulusType::Video], true) && $group->stimulus_media_path
                ? route('exam.media.stimulus', $group)
                : null,
            'slides' => $group->stimulus_type === StimulusType::Flash
                ? collect($group->stimulus_slides ?? [])->map(fn ($slide, $i) => [
                    'url' => route('exam.media.slide', [$group, $i]),
                    'duration' => (int) $slide['duration'],
                ])->values()
                : null,
        ];
    }

    private function question(Question $question, int $number): array
    {
        return [
            'id' => $question->id,
            'number' => $number,
            'locked' => false,
            'body' => $question->body,
            'is_latex' => $question->is_latex,
            'image_url' => $question->image_path ? route('exam.media.question', $question) : null,
            'options_are_images' => $question->options_are_images,
            'options' => $question->options->map(fn (QuestionOption $option) => [
                'id' => $option->id,
                'label' => $option->label(),
                'content' => $question->options_are_images ? route('exam.media.option', $option) : $option->content,
            ])->values(),
        ];
    }
}
