<?php

namespace Tests\Feature\Exam;

use App\Enums\AttemptStatus;
use App\Http\Middleware\EnsureSingleParticipantSession;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Models\Question;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubmitAnswersTest extends TestCase
{
    use RefreshDatabase;

    private Exam $exam;

    private Participant $participant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->freezeSecond();
        $this->exam = Exam::factory()->withQuestions(perSection: 3, sectionSeconds: 600)->create(['break_seconds' => 120]);
        $this->participant = Participant::factory()->create();

        $this->withoutMiddleware(EnsureSingleParticipantSession::class);
        $this->actingAs($this->participant, 'participant');
        $this->post(route('exam.start'));
    }

    private function attempt(): ExamAttempt
    {
        return ExamAttempt::where('participant_id', $this->participant->id)->firstOrFail();
    }

    private function sectionId(int $position): int
    {
        return $this->exam->sections()->where('position', $position)->firstOrFail()->id;
    }

    private function questionsOf(int $position)
    {
        return Question::whereHas('group.section', fn ($q) => $q->where('position', $position)->where('exam_id', $this->exam->id))
            ->with('options')->orderBy('position')->get();
    }

    private function correct(Question $q): int
    {
        return $q->options->firstWhere('is_correct', true)->id;
    }

    private function wrong(Question $q): int
    {
        return $q->options->firstWhere('is_correct', false)->id;
    }

    private function observeMemory(): void
    {
        $group = $this->exam->sections()->first()->groups()->first();
        $this->post(route('exam.observation.start', $group));
        $this->post(route('exam.observation.finish', $group));
    }

    private function item(Question $q, ?int $option, ?int $t = null): array
    {
        return ['q' => $q->id, 'o' => $option, 't' => $t ?? now()->getTimestampMs()];
    }

    public function test_checkpoint_saves_many_answers_in_one_request(): void
    {
        $this->observeMemory();
        [$q1, $q2, $q3] = $this->questionsOf(1);

        $this->postJson(route('exam.checkpoint'), [
            'section_id' => $this->sectionId(1),
            'answers' => [$this->item($q1, $this->correct($q1)), $this->item($q2, $this->wrong($q2)), $this->item($q3, null)],
        ])->assertOk()->assertJson(['accepted' => 3, 'rejected' => []]);

        $this->assertSame(3, $this->attempt()->answers()->count());
    }

    public function test_invalid_items_are_skipped_without_failing_the_rest(): void
    {
        $this->observeMemory();
        [$q1, $q2] = $this->questionsOf(1);

        $this->postJson(route('exam.checkpoint'), [
            'section_id' => $this->sectionId(1),
            'answers' => [$this->item($q1, $this->correct($q1)), $this->item($q2, $q1->options->last()->id)], // opsi milik soal lain
        ])->assertOk()->assertJson(['accepted' => 1, 'rejected' => [$q2->id]]);
    }

    public function test_answers_are_rejected_until_observation_is_done(): void
    {
        [$q1] = $this->questionsOf(1);

        $this->postJson(route('exam.checkpoint'), [
            'section_id' => $this->sectionId(1),
            'answers' => [$this->item($q1, $this->correct($q1))],
        ])->assertOk()->assertJson(['accepted' => 0, 'rejected' => [$q1->id]]);
    }

    public function test_cannot_write_to_a_pillar_that_has_not_started(): void
    {
        [$q] = $this->questionsOf(2);

        $this->postJson(route('exam.checkpoint'), [
            'section_id' => $this->sectionId(2),
            'answers' => [$this->item($q, $this->correct($q))],
        ])->assertStatus(422);
    }

    public function test_final_submit_with_payload_saves_answers_and_closes_the_pillar(): void
    {
        $this->observeMemory();
        [$q1, $q2] = $this->questionsOf(1);

        $this->post(route('exam.section.finish'), [
            'section_id' => $this->sectionId(1),
            'answers' => [$this->item($q1, $this->correct($q1)), $this->item($q2, $this->wrong($q2))],
        ])->assertRedirect(route('exam.session'));

        $this->assertSame(AttemptStatus::OnBreak, $this->attempt()->status);
        $this->assertSame(2, $this->attempt()->answers()->count());
    }

    public function test_manually_finished_pillar_accepts_nothing_more(): void
    {
        $this->observeMemory();
        [$q1] = $this->questionsOf(1);

        $this->post(route('exam.section.finish'));

        $this->postJson(route('exam.checkpoint'), [
            'section_id' => $this->sectionId(1),
            'answers' => [$this->item($q1, $this->correct($q1))],
        ])->assertStatus(422);
    }

    public function test_late_snapshot_is_accepted_only_for_answers_made_before_the_deadline(): void
    {
        $this->observeMemory();
        [$q1, $q2] = $this->questionsOf(1);
        $deadline = $this->attempt()->sections()->first()->deadline_at;

        $this->travel(600 + 10)->seconds();

        $this->postJson(route('exam.checkpoint'), [
            'section_id' => $this->sectionId(1),
            'answers' => [
                $this->item($q1, $this->correct($q1), $deadline->getTimestampMs() - 2000),
                $this->item($q2, $this->correct($q2), $deadline->getTimestampMs() + 60000),
            ],
        ])->assertOk()->assertJson(['accepted' => 1, 'rejected' => [$q2->id]]);

        $this->assertSame(AttemptStatus::OnBreak, $this->attempt()->status);
    }

    public function test_late_snapshot_after_the_window_is_refused(): void
    {
        $this->observeMemory();
        [$q1] = $this->questionsOf(1);
        $deadline = $this->attempt()->sections()->first()->deadline_at;

        $this->travel(600 + 301)->seconds();

        $this->postJson(route('exam.checkpoint'), [
            'section_id' => $this->sectionId(1),
            'answers' => [$this->item($q1, $this->correct($q1), $deadline->getTimestampMs() - 1000)],
        ])->assertStatus(422);
    }

    public function test_late_snapshot_rescores_an_attempt_already_submitted_by_the_scheduler(): void
    {
        $this->observeMemory();
        $this->post(route('exam.section.finish'));

        foreach ([2, 3] as $_) {
            $this->post(route('exam.break.skip'));
            $this->post(route('exam.section.finish'));
        }
        $this->post(route('exam.break.skip')); // masuk pilar 4

        $deadline = $this->attempt()->sections()->where('exam_section_id', $this->sectionId(4))->first()->deadline_at;

        $this->travel(600 + 10)->seconds();
        $this->artisan('exam:sync-attempts');

        $this->assertSame(AttemptStatus::Submitted, $this->attempt()->status);
        $this->assertSame(0, (int) $this->attempt()->score_total);

        [$q] = $this->questionsOf(4);
        $this->postJson(route('exam.checkpoint'), [
            'section_id' => $this->sectionId(4),
            'answers' => [$this->item($q, $this->correct($q), $deadline->getTimestampMs() - 1000)],
        ])->assertOk()->assertJson(['accepted' => 1]);

        $this->assertGreaterThan(0, (int) $this->attempt()->score_total);
    }
}