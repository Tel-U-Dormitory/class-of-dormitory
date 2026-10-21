<?php

namespace Tests\Feature\Exam;

use App\Enums\AttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\ParticipantStatus;
use App\Http\Middleware\EnsureSingleParticipantSession;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Models\Question;
use App\Models\QuestionGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ExamFlowTest extends TestCase
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
    }

    private function actingAsParticipant(): static
    {
        // Middleware sesi tunggal diuji terpisah di ParticipantAccessTest.
        $this->withoutMiddleware(EnsureSingleParticipantSession::class);
        $this->actingAs($this->participant, 'participant');

        return $this;
    }

    private function attempt(): ExamAttempt
    {
        return ExamAttempt::where('participant_id', $this->participant->id)->firstOrFail();
    }

    private function memoryGroup(): QuestionGroup
    {
        return $this->exam->sections()->first()->groups()->first();
    }

    private function questionsOf(int $sectionPosition)
    {
        return Question::whereHas('group.section', fn ($q) => $q->where('position', $sectionPosition)->where('exam_id', $this->exam->id))
            ->with('options')->orderBy('position')->get();
    }

    private function correctOptionId(Question $question): int
    {
        return $question->options->firstWhere('is_correct', true)->id;
    }

    private function wrongOptionId(Question $question): int
    {
        return $question->options->firstWhere('is_correct', false)->id;
    }

    private function observeMemory(): void
    {
        $this->post(route('exam.observation.start', $this->memoryGroup()))->assertRedirect();
        $this->post(route('exam.observation.finish', $this->memoryGroup()))->assertRedirect();
    }

    public function test_starting_creates_attempt_with_server_deadline(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'))->assertRedirect(route('exam.session'));

        $attempt = $this->attempt();
        $section = $attempt->sections()->first();

        $this->assertSame(AttemptStatus::InProgress, $attempt->status);
        $this->assertTrue($section->deadline_at->equalTo(now()->addSeconds(600)));
        $this->assertSame(ParticipantStatus::InExam, $this->participant->fresh()->status);
    }

    public function test_reloading_does_not_reset_the_timer(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'));
        $deadline = $this->attempt()->sections()->first()->deadline_at;

        $this->travel(5)->minutes();
        $this->post(route('exam.start'));
        $this->get(route('exam.session'))->assertOk();

        $this->assertEquals($deadline, $this->attempt()->sections()->first()->deadline_at);
        $this->assertSame(1, ExamAttempt::count());
    }

    public function test_session_payload_never_contains_answer_keys(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'));
        $this->observeMemory();

        $response = $this->get(route('exam.session'));
        $response->assertOk();

        $this->assertStringNotContainsString('is_correct', $response->getContent());
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('exam/session')
            ->where('current.groups.0.questions.0.locked', false)
            ->has('current.groups.0.questions.0.options', 4));
    }

    public function test_observation_group_is_locked_until_observed(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'));
        $question = $this->questionsOf(1)->first();

        $this->get(route('exam.session'))->assertInertia(fn (AssertableInertia $page) => $page
            ->where('current.groups.0.observation.state', 'pending')
            ->where('current.groups.0.questions.0.locked', true)
            ->missing('current.groups.0.questions.0.body'));

        $this->postJson(route('exam.answer', $question), ['option_id' => $this->correctOptionId($question)])->assertStatus(422);

        $this->post(route('exam.observation.start', $this->memoryGroup()));
        $this->get(route('exam.session'))->assertInertia(fn (AssertableInertia $page) => $page
            ->where('current.groups.0.observation.state', 'active')
            ->where('current.groups.0.stimulus.text', 'Hafalkan: kode gedung adalah 7.'));

        // Masih dalam fase observasi: belum boleh menjawab.
        $this->postJson(route('exam.answer', $question), ['option_id' => $this->correctOptionId($question)])->assertStatus(422);

        $this->travel(31)->seconds();
        $this->postJson(route('exam.answer', $question), ['option_id' => $this->correctOptionId($question)])->assertOk();

        // Materi tidak bisa ditampilkan ulang dan tidak lagi dikirim.
        $this->post(route('exam.observation.start', $this->memoryGroup()))->assertSessionHas('error');
        $this->get(route('exam.session'))->assertInertia(fn (AssertableInertia $page) => $page
            ->where('current.groups.0.observation.state', 'done')
            ->where('current.groups.0.stimulus', null));
    }

    public function test_timeout_moves_to_break_then_next_section_starts_at_break_end(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'));
        $startedAt = now()->toImmutable();

        $this->travel(600 + 5)->seconds();
        $this->get(route('exam.session'))->assertOk();

        $attempt = $this->attempt();
        $this->assertSame(AttemptStatus::OnBreak, $attempt->status);
        $this->assertTrue($attempt->break_ends_at->equalTo($startedAt->addSeconds(600 + 120)));

        $this->travel(200)->seconds();
        $this->get(route('exam.session'))->assertOk();

        $attempt = $this->attempt();
        $second = $attempt->sections()->where('exam_section_id', $attempt->current_section_id)->first();
        $this->assertSame(AttemptStatus::InProgress, $attempt->status);
        $this->assertSame(2, $second->section->position);
        $this->assertTrue($second->started_at->equalTo($startedAt->addSeconds(720)));
    }

    public function test_finished_section_is_locked(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'));
        $this->post(route('exam.section.finish'));
        $this->post(route('exam.break.skip'));

        $memoryQuestion = $this->questionsOf(1)->first();
        $this->postJson(route('exam.answer', $memoryQuestion), ['option_id' => $this->correctOptionId($memoryQuestion)])
            ->assertStatus(422);
    }

    public function test_answer_from_another_question_is_rejected(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'));
        $this->post(route('exam.section.finish'));
        $this->post(route('exam.break.skip'));

        [$a, $b] = $this->questionsOf(2);
        $this->postJson(route('exam.answer', $a), ['option_id' => $b->options->first()->id])->assertStatus(422);
    }

    public function test_finishing_all_sections_submits_and_scores(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'));
        $this->observeMemory();

        // Memory: 2 benar, 1 salah → 4 + 4 - 1 = 7
        [$m1, $m2, $m3] = $this->questionsOf(1);
        $this->postJson(route('exam.answer', $m1), ['option_id' => $this->correctOptionId($m1)])->assertOk();
        $this->postJson(route('exam.answer', $m2), ['option_id' => $this->correctOptionId($m2)])->assertOk();
        $this->postJson(route('exam.answer', $m3), ['option_id' => $this->wrongOptionId($m3)])->assertOk();
        $this->post(route('exam.section.finish'));

        // Spatial: 1 benar lalu diganti salah, 1 dikosongkan → -1
        $this->post(route('exam.break.skip'));
        [$s1, $s2] = $this->questionsOf(2);
        $this->postJson(route('exam.answer', $s1), ['option_id' => $this->correctOptionId($s1)]);
        $this->postJson(route('exam.answer', $s1), ['option_id' => $this->wrongOptionId($s1)]);
        $this->postJson(route('exam.answer', $s2), ['option_id' => $this->correctOptionId($s2)]);
        $this->postJson(route('exam.answer', $s2), ['option_id' => null]);
        $this->post(route('exam.section.finish'));

        foreach ([3, 4] as $position) {
            $this->post(route('exam.break.skip'));
            $this->post(route('exam.section.finish'));
        }

        $attempt = $this->attempt();
        $this->assertSame(AttemptStatus::Submitted, $attempt->status);
        $this->assertSame(6, $attempt->score_total);
        $this->assertSame(2, $attempt->correct_count);
        $this->assertSame(2, $attempt->wrong_count);
        $this->assertSame(ParticipantStatus::Submitted, $this->participant->fresh()->status);

        $this->get(route('exam.session'))->assertRedirect(route('exam.finished'));
        $this->post(route('exam.start'))->assertRedirect(route('exam.session'));
        $this->postJson(route('exam.answer', $m1), ['option_id' => $this->wrongOptionId($m1)])->assertStatus(422);
    }

    public function test_cannot_start_when_exam_closed(): void
    {
        $this->exam->update(['status' => ExamStatus::Closed]);

        $this->actingAsParticipant()->post(route('exam.start'))->assertSessionHas('error');
        $this->assertSame(0, ExamAttempt::count());
    }

    public function test_offline_participant_is_submitted_by_scheduler(): void
    {
        $this->actingAsParticipant()->post(route('exam.start'));

        $this->travel(4 * 600 + 3 * 120 + 10)->seconds();
        $this->artisan('exam:sync-attempts')->assertSuccessful();

        $attempt = $this->attempt();
        $this->assertSame(AttemptStatus::Submitted, $attempt->status);
        $this->assertSame('time_up', $attempt->submit_reason->value);
        $this->assertSame(4 * 600, $attempt->duration_seconds);
    }

    public function test_stimulus_media_requires_active_observation(): void
    {
        $group = $this->memoryGroup();
        $group->update(['stimulus_type' => 'image', 'stimulus_media_path' => 'exam-media/test.png', 'stimulus_text' => null]);
        \Illuminate\Support\Facades\Storage::fake('local');
        \Illuminate\Support\Facades\Storage::disk('local')->put('exam-media/test.png', 'png');

        $this->actingAsParticipant()->post(route('exam.start'));
        $this->get(route('exam.media.stimulus', $group))->assertForbidden();

        $this->post(route('exam.observation.start', $group));
        $this->get(route('exam.media.stimulus', $group))->assertOk();

        $this->travel(40)->seconds();
        $this->get(route('exam.media.stimulus', $group))->assertForbidden();
    }
}
