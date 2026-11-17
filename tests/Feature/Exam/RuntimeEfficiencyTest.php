<?php

namespace Tests\Feature\Exam;

use App\Enums\AttemptStatus;
use App\Enums\StimulusType;
use App\Http\Middleware\EnsureSingleParticipantSession;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Services\Exam\ExamEngine;
use App\Services\Exam\ScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class RuntimeEfficiencyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeSecond();
    }

    private function started(): ExamAttempt
    {
        $exam = Exam::factory()->withQuestions(1, 600)->create(['break_seconds' => 120]);
        return app(ExamEngine::class)->start(Participant::factory()->create(), $exam);
    }

    public function test_each_pinned_image_uses_one_metadata_query_and_still_checks_observation(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('exam-media/test.png', 'image');
        $attempt = $this->started();
        $group = $attempt->currentSection->groups()->first();
        $group->update(['stimulus_type' => StimulusType::Flash,
            'stimulus_slides' => [['path' => 'exam-media/test.png', 'duration' => 5]]]);
        $question = $group->questions()->first();
        $question->update(['image_path' => 'exam-media/test.png', 'options_are_images' => true]);
        $option = $question->options()->first();
        $option->update(['content' => 'exam-media/test.png']);
        $attempt->observations()->create(['question_group_id' => $group->id,
            'started_at' => now(), 'ends_at' => now()->addSeconds(5)]);
        $this->withoutMiddleware(EnsureSingleParticipantSession::class);
        $this->actingAs($attempt->participant, 'participant');
        config(['exam-media.log_requests' => true]);
        $url = route('exam.media.question', [$question, 'attempt' => $attempt->id]);
        $this->get($url)->assertForbidden();
        $this->get(route('exam.media.slide', [$group, 0, 'attempt' => $attempt->id]))->assertOk();
        $this->travel(8)->seconds();
        $this->get(route('exam.media.slide', [$group, 0, 'attempt' => $attempt->id]))->assertForbidden();

        foreach ([$url, route('exam.media.option', [$option, 'attempt' => $attempt->id])] as $imageUrl) {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->get($imageUrl)->assertOk();
            $queries = DB::getQueryLog();
            DB::disableQueryLog();
            $this->assertCount(1, $queries, 'Image metadata and permission must use one database round trip.');
        }
        $question->update(['is_active' => false]);
        $this->get($url)->assertForbidden();
        $this->get('/ujian/media/soal/not-a-number')->assertNotFound();
    }

    public function test_non_due_heartbeat_does_not_sync_and_reuses_loaded_deadline(): void
    {
        $attempt = $this->started();
        $engine = Mockery::mock(ExamEngine::class, [app(ScoringService::class)])->makePartial();
        $engine->shouldNotReceive('sync');
        $this->app->instance(ExamEngine::class, $engine);
        $this->withoutMiddleware(EnsureSingleParticipantSession::class);
        $this->actingAs($attempt->participant, 'participant');
        $deadline = $attempt->sections()->first()->deadline_at->getTimestampMs();

        DB::enableQueryLog();
        $this->postJson(route('exam.heartbeat'))->assertOk()->assertJson(['deadline_at' => $deadline]);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
        $this->assertCount(3, $queries, 'Current exam, attempt and section snapshot only when recently touched.');
        $this->travel(30)->seconds();
        $this->postJson(route('exam.heartbeat'))->assertOk();
        $this->assertTrue($attempt->fresh()->last_seen_at->equalTo(now()));

        $attempt->sections()->first()->update(['deadline_at' => now()->addSeconds(900)]);
        $this->postJson(route('exam.heartbeat'))->assertOk()->assertJson([
            'deadline_at' => $attempt->sections()->first()->deadline_at->getTimestampMs(),
        ]);
    }

    public function test_heartbeat_still_closes_due_sections_and_opens_due_breaks(): void
    {
        $attempt = $this->started();
        $this->travel(604)->seconds();
        $attempt = app(ExamEngine::class)->heartbeat($attempt->fresh());
        $this->assertSame(AttemptStatus::OnBreak, $attempt->status);
        $this->travel(120)->seconds();
        $attempt = app(ExamEngine::class)->heartbeat($attempt->fresh());
        $this->assertSame(AttemptStatus::InProgress, $attempt->status);
        $this->assertSame(2, $attempt->currentSection->position);
    }

    public function test_scheduler_skips_future_attempts_and_syncs_due_attempts_only(): void
    {
        $future = $this->started();
        $due = $this->started();
        $due->sections()->first()->update(['deadline_at' => now()->subSeconds(4)]);
        $engine = Mockery::mock(ExamEngine::class, [app(ScoringService::class)])->makePartial();
        $engine->shouldReceive('sync')->once()->withArgs(fn ($a) => $a->id === $due->id)->passthru();
        $this->app->instance(ExamEngine::class, $engine);
        $this->artisan('exam:sync-attempts')->assertSuccessful();
        $this->assertSame(AttemptStatus::InProgress, $future->fresh()->status);
        $this->assertSame(AttemptStatus::OnBreak, $due->fresh()->status);
    }

    public function test_file_session_survives_a_new_store_instance(): void
    {
        $path = sys_get_temp_dir().'/cod-session-'.bin2hex(random_bytes(8));
        mkdir($path, 0700);
        config(['session.driver' => 'file', 'session.files' => $path]);
        try {
            $manager = new \Illuminate\Session\SessionManager($this->app);
            $session = $manager->driver('file');
            $session->start();
            $session->put('runtime-test', 'persisted');
            $id = $session->getId();
            $session->save();
            $reopened = (new \Illuminate\Session\SessionManager($this->app))->driver('file');
            $reopened->setId($id);
            $reopened->start();
            $this->assertSame('persisted', $reopened->get('runtime-test'));
            $reopened->invalidate();
            $this->assertFileDoesNotExist($path.'/'.$id);
        } finally {
            \Illuminate\Support\Facades\File::deleteDirectory($path);
        }
    }
}
