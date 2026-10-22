<?php

namespace App\Http\Controllers\Exam;

use App\Enums\AttemptEventType;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Exam\Concerns\ResolvesAttempt;
use App\Models\Question;
use App\Services\Exam\ExamEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Endpoint JSON ringan agar menyimpan jawaban tidak memuat ulang halaman.
 */
class AnswerController extends Controller
{
    use ResolvesAttempt;

    public function store(Request $request, Question $question, ExamEngine $engine): JsonResponse
    {
        $data = $request->validate([
            'option_id' => ['nullable', 'integer'],
        ]);

        $answer = $engine->answer($this->attempt($request), $question, $data['option_id'] ?? null);

        return response()->json([
            'question_id' => $answer->question_id,
            'option_id' => $answer->question_option_id,
            'saved_at' => $answer->answered_at->getTimestampMs(),
        ]);
    }

    public function event(Request $request, ExamEngine $engine): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::enum(AttemptEventType::class)],
        ]);

        $engine->recordEvent($this->attempt($request), AttemptEventType::from($data['type']));

        return response()->json(['ok' => true]);
    }

    public function heartbeat(Request $request, ExamEngine $engine): JsonResponse
    {
        $attempt = $engine->touch($this->attempt($request));

        return response()->json([
            'status' => $attempt->status->value,
            'section_id' => $attempt->current_section_id,
            'server_now' => now()->getTimestampMs(),
        ]);
    }
}
