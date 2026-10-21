<?php

namespace App\Http\Controllers;

use App\Enums\Pillar;
use App\Support\CurrentExam;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(): Response
    {
        $exam = CurrentExam::get()?->load('sections');

        return Inertia::render('welcome', [
            'exam' => $exam ? [
                'title' => $exam->title,
                'description' => $exam->description,
                'is_open' => $exam->isOpen(),
                'scheduled_at' => $exam->scheduled_at?->toIso8601String(),
                'total_minutes' => intdiv($exam->totalDurationSeconds(), 60),
            ] : null,
            'pillars' => collect(Pillar::cases())->map(fn (Pillar $p) => [
                'value' => $p->value,
                'label' => $p->label(),
                'description' => $p->description(),
            ]),
        ]);
    }
}
