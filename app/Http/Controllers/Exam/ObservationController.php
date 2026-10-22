<?php

namespace App\Http\Controllers\Exam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Exam\Concerns\ResolvesAttempt;
use App\Models\QuestionGroup;
use App\Services\Exam\ExamEngine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ObservationController extends Controller
{
    use ResolvesAttempt;

    public function start(Request $request, QuestionGroup $group, ExamEngine $engine): RedirectResponse
    {
        $engine->startObservation($this->attempt($request), $group);

        return to_route('exam.session');
    }

    public function finish(Request $request, QuestionGroup $group, ExamEngine $engine): RedirectResponse
    {
        $engine->finishObservation($this->attempt($request), $group);

        return to_route('exam.session');
    }
}
