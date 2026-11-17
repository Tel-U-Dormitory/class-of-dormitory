<?php

namespace App\Http\Controllers\Exam;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Exam\Concerns\ResolvesAttempt;
use App\Services\Exam\ExamMediaGate;
use App\Services\Exam\ExamMediaResponse;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class MediaController extends Controller
{
    use ResolvesAttempt { attempt as legacyAttempt; }

    public function __construct(private ExamMediaGate $gate) {}

    private function metadata(Request $request): Builder
    {
        $attemptId = $request->has('attempt')
            ? $request->validate(['attempt' => ['required', 'integer', 'min:1']])['attempt']
            : $this->legacyAttempt($request)->id;

        // One database snapshot; never cache a participant's current permission.
        return DB::table('question_groups as g')
            ->crossJoin('exam_attempts as a')
            ->leftJoin('attempt_observations as observation', function ($join) {
                $join->on('observation.exam_attempt_id', '=', 'a.id')
                    ->on('observation.question_group_id', '=', 'g.id');
            })
            ->where('a.id', $attemptId)
            ->where('a.participant_id', $request->user('participant')->id)
            ->select(['g.id as group_id', 'g.exam_section_id', 'g.stimulus_type',
                'a.id as attempt_id', 'a.status', 'a.current_section_id',
                'observation.ends_at as observation_ends_at']);
    }

    public function stimulus(Request $request, int $group): Response
    {
        $media = $this->metadata($request)->where('g.id', $group)
            ->addSelect('g.stimulus_media_path as media_path')->first();
        abort_unless($media, 404);
        abort_unless($media->media_path && $this->gate->canViewStimulus($media), 403);

        return $this->file($media->media_path);
    }

    public function slide(Request $request, int $group, int $index): Response
    {
        $media = $this->metadata($request)->where('g.id', $group)
            ->addSelect('g.stimulus_slides')->first();
        abort_unless($media, 404);
        $slides = json_decode($media->stimulus_slides ?? '[]', true);
        $path = $slides[$index]['path'] ?? null;
        abort_unless($path && $this->gate->canViewStimulus($media), 403);

        return $this->file($path);
    }

    public function question(Request $request, int $question): Response
    {
        $media = $this->metadata($request)->join('questions as q', 'q.question_group_id', '=', 'g.id')
            ->where('q.id', $question)
            ->addSelect(['q.id as question_id', 'q.is_active', 'q.image_path as media_path'])->first();
        abort_unless($media, 404);
        abort_unless($media->media_path && $this->gate->canViewQuestion($media), 403);

        return $this->file($media->media_path);
    }

    public function option(Request $request, int $option): Response
    {
        $media = $this->metadata($request)->join('questions as q', 'q.question_group_id', '=', 'g.id')
            ->join('question_options as choice', 'choice.question_id', '=', 'q.id')
            ->where('choice.id', $option)
            ->addSelect(['q.id as question_id', 'q.is_active', 'q.options_are_images', 'choice.content as media_path'])->first();
        abort_unless($media, 404);
        abort_unless($media->options_are_images && $this->gate->canViewQuestion($media), 403);

        return $this->file($media->media_path);
    }

    private function file(string $path): Response
    {
        return app(ExamMediaResponse::class)->file($path);
    }
}
