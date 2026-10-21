<?php

namespace App\Http\Controllers\Exam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Exam\Concerns\ResolvesAttempt;
use App\Models\Question;
use App\Models\QuestionGroup;
use App\Models\QuestionOption;
use App\Services\Exam\ExamMediaGate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Media soal disimpan privat dan hanya dikirim saat peserta berhak melihatnya.
 */
class MediaController extends Controller
{
    use ResolvesAttempt;

    public function __construct(private ExamMediaGate $gate) {}

    public function stimulus(Request $request, QuestionGroup $group): Response
    {
        abort_unless($group->stimulus_media_path && $this->gate->canViewStimulus($this->attempt($request), $group), 403);

        return $this->file($group->stimulus_media_path);
    }

    public function slide(Request $request, QuestionGroup $group, int $index): Response
    {
        $path = $group->stimulus_slides[$index]['path'] ?? null;
        abort_unless($path && $this->gate->canViewStimulus($this->attempt($request), $group), 403);

        return $this->file($path);
    }

    public function question(Request $request, Question $question): Response
    {
        abort_unless($question->image_path && $this->gate->canViewQuestion($this->attempt($request), $question), 403);

        return $this->file($question->image_path);
    }

    public function option(Request $request, QuestionOption $option): Response
    {
        $question = $option->question;
        abort_unless($question->options_are_images && $this->gate->canViewQuestion($this->attempt($request), $question), 403);

        return $this->file($option->content);
    }

    private function file(string $path): Response
    {
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, [
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
