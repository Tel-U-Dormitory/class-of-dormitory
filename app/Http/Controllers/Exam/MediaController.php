<?php

namespace App\Http\Controllers\Exam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Exam\Concerns\ResolvesAttempt;
use App\Models\ExamAttempt;
use App\Models\Question;
use App\Models\QuestionGroup;
use App\Models\QuestionOption;
use App\Services\Exam\ExamMediaGate;
use App\Services\Exam\ExamMediaResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Media soal disimpan privat dan hanya dikirim saat peserta berhak melihatnya.
 */
class MediaController extends Controller
{
    use ResolvesAttempt { attempt as legacyAttempt; }

    protected function attempt(Request $request): ExamAttempt
    {
        // Old open pages remain compatible; newly presented URLs pin the attempt.
        if (! $request->has('attempt')) {
            return $this->legacyAttempt($request);
        }
        $data = $request->validate(['attempt' => ['required', 'integer', 'min:1']]);

        return ExamAttempt::query()
            ->select(['id', 'exam_id', 'participant_id', 'status', 'current_section_id'])
            ->whereKey($data['attempt'])
            ->where('participant_id', $request->user('participant')->id)
            ->firstOrFail();
    }

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
        return app(ExamMediaResponse::class)->file($path);
    }
}
