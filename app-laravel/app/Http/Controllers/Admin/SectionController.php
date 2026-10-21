<?php

namespace App\Http\Controllers\Admin;

use App\Enums\StimulusType;
use App\Http\Controllers\Controller;
use App\Models\ExamSection;
use App\Models\Question;
use App\Models\QuestionGroup;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Bank soal per pilar: grup (beserta materi observasi) dan soal di dalamnya.
 */
class SectionController extends Controller
{
    public function show(ExamSection $section): Response
    {
        $section->load(['exam.sections', 'groups.questions.options']);

        return Inertia::render('admin/sections/show', [
            'exam' => [
                'id' => $section->exam->id,
                'title' => $section->exam->title,
                'sections' => $section->exam->sections->map(fn ($s) => ['id' => $s->id, 'label' => $s->label()]),
            ],
            'section' => [
                'id' => $section->id,
                'pillar' => $section->pillar->value,
                'label' => $section->label(),
                'minutes' => intdiv($section->duration_seconds, 60),
            ],
            'groups' => $section->groups->map(fn (QuestionGroup $group) => [
                'id' => $group->id,
                'title' => $group->title,
                'kind' => $group->kind,
                'position' => $group->position,
                'stimulus_type' => $group->stimulus_type->value,
                'stimulus_text' => $group->stimulus_text,
                'stimulus_duration_seconds' => $group->stimulus_duration_seconds,
                'stimulus_media_url' => MediaController::urlFor($group->stimulus_media_path),
                'stimulus_slides' => collect($group->stimulus_slides ?? [])->map(fn ($slide) => [
                    'path' => $slide['path'],
                    'url' => MediaController::urlFor($slide['path']),
                    'duration' => (int) $slide['duration'],
                ])->values(),
                'questions' => $group->questions->map(fn (Question $q) => [
                    'id' => $q->id,
                    'position' => $q->position,
                    'body' => $q->body,
                    'is_latex' => $q->is_latex,
                    'image_url' => MediaController::urlFor($q->image_path),
                    'options_are_images' => $q->options_are_images,
                    'points' => $q->points,
                    'penalty' => $q->penalty,
                    'is_active' => $q->is_active,
                    'notes' => $q->notes,
                    'options' => $q->options->map(fn ($o) => [
                        'id' => $o->id,
                        'label' => $o->label(),
                        'content' => $q->options_are_images ? null : $o->content,
                        'image_url' => $q->options_are_images ? MediaController::urlFor($o->content) : null,
                        'is_correct' => $o->is_correct,
                    ]),
                ]),
            ]),
            'stimulusTypes' => collect(StimulusType::cases())->map(fn ($t) => ['value' => $t->value, 'label' => $t->label()]),
        ]);
    }
}
