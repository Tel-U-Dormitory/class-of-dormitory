<?php

namespace Tests\Feature\Exam;

use App\Enums\AttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\UserRole;
use App\Http\Middleware\EnsureSingleParticipantSession;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Models\User;
use App\Services\Exam\ExamMediaResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ExamMediaOptimizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_pinned_attempt_survives_global_exam_change_and_rejects_other_participant(): void
    {
        Storage::fake('local');
        $exam = Exam::factory()->withQuestions()->create();
        $section = $exam->sections()->orderBy('position')->skip(1)->first();
        $question = $section->groups()->first()->questions()->first();
        $question->update(['image_path' => 'exam-media/test.png']);
        Storage::disk('local')->put('exam-media/test.png', 'png');
        $participant = Participant::factory()->create();
        $attempt = ExamAttempt::create([
            'exam_id' => $exam->id, 'participant_id' => $participant->id,
            'status' => AttemptStatus::InProgress, 'current_section_id' => $section->id,
            'started_at' => now(),
        ]);
        Exam::factory()->create();
        $this->withoutMiddleware(EnsureSingleParticipantSession::class);
        $url = route('exam.media.question', [$question, 'attempt' => $attempt->id]);
        $this->actingAs($participant, 'participant')->get($url)->assertOk();
        $question->update(['options_are_images' => true]);
        $option = $question->options()->first();
        $option->update(['content' => 'exam-media/test.png']);
        $this->get(route('exam.media.option', [$option, 'attempt' => $attempt->id]))->assertOk();
        $attempt->update(['current_section_id' => $exam->sections()->first()->id]);
        $this->get($url)->assertForbidden();
        $attempt->update(['current_section_id' => $section->id]);
        $this->actingAs(Participant::factory()->create(), 'participant')->get($url)->assertNotFound();
        $this->actingAs($participant, 'participant');
        $attempt->update(['status' => AttemptStatus::Submitted]);
        $this->get($url)->assertForbidden();
    }

    public function test_failed_question_update_retains_old_file_and_removes_new_uploads(): void
    {
        Storage::fake('local');
        $exam = Exam::factory()->withQuestions()->create(['status' => ExamStatus::Draft]);
        $question = $exam->sections()->first()->groups()->first()->questions()->first();
        $question->update(['image_path' => 'exam-media/old.png']);
        Storage::disk('local')->put('exam-media/old.png', 'old');
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $this->actingAs($admin)->put(route('admin.questions.update', $question), [
            'body' => 'Updated', 'image' => UploadedFile::fake()->image('new.png'),
            'points' => 1, 'penalty' => 0, 'correct_option' => 0,
            'options' => [['content' => 'A'], ['content' => '']],
        ])->assertSessionHasErrors('options.1.content');
        $this->assertSame('exam-media/old.png', $question->fresh()->image_path);
        $this->assertSame(['exam-media/old.png'], Storage::disk('local')->allFiles());
    }

    public function test_offload_is_opt_in_and_rejects_traversal(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('exam-media/test.png', 'png');
        config(['exam-media.accel_redirect' => true]);
        $response = app(ExamMediaResponse::class)->file('exam-media/test.png');
        $this->assertSame('/_exam-media/test.png', $response->headers->get('X-Accel-Redirect'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->expectException(HttpException::class);
        app(ExamMediaResponse::class)->file('exam-media/../secret');
    }

    public function test_existing_image_conversion_is_dry_by_default_and_blocks_used_exams(): void
    {
        Storage::fake('local');
        $exam = Exam::factory()->withQuestions()->create();
        $question = $exam->sections()->first()->groups()->first()->questions()->first();
        $file = UploadedFile::fake()->image('diagram.png', 800, 600);
        Storage::disk('local')->put('exam-media/old.png', file_get_contents($file->getRealPath()));
        $question->update(['image_path' => 'exam-media/old.png']);
        $this->artisan('exam:optimize-images', ['exam' => $exam->id])->assertSuccessful();
        $this->assertSame(['exam-media/old.png'], Storage::disk('local')->allFiles());
        $this->artisan('exam:optimize-images', ['exam' => $exam->id, '--apply' => true])->assertFailed();
        $exam->update(['status' => ExamStatus::Draft]);
        $this->artisan('exam:optimize-images', ['exam' => $exam->id, '--apply' => true])->assertSuccessful();
        Storage::disk('local')->assertExists('exam-media/old.png');
        Storage::disk('local')->assertExists($question->fresh()->image_path);
        $this->assertCount(1, Storage::disk('local')->files('exam-media/manifests'));
        $this->artisan('exam:audit-media', ['exam' => $exam->id])->assertSuccessful();
    }
}
