<?php

namespace Tests\Feature\Exam;

use App\Enums\AttemptStatus;
use App\Enums\SubmitReason;
use App\Enums\UserRole;
use App\Models\AttemptAnswer;
use App\Models\AttemptSection;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Models\Question;
use App\Models\User;
use App\Services\Exam\ScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SectionScoreAdjustmentTest extends TestCase
{
    use RefreshDatabase;

    private Exam $exam;
    private Participant $participant;
    private ExamAttempt $attempt;
    private User $admin;
    private User $operator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => UserRole::Admin]);
        $this->operator = User::factory()->create(['role' => UserRole::Operator]);

        $this->exam = Exam::factory()->withQuestions(perSection: 3, sectionSeconds: 600)->create();
        $this->participant = Participant::factory()->create();

        $firstSection = $this->exam->sections()->orderBy('position')->first();

        $this->attempt = ExamAttempt::create([
            'exam_id' => $this->exam->id,
            'participant_id' => $this->participant->id,
            'status' => AttemptStatus::Submitted,
            'current_section_id' => $firstSection->id,
            'started_at' => now()->subMinutes(30),
            'submitted_at' => now(),
            'submit_reason' => SubmitReason::Manual,
            'duration_seconds' => 1800,
        ]);

        foreach ($this->exam->sections as $sec) {
            AttemptSection::create([
                'exam_attempt_id' => $this->attempt->id,
                'exam_section_id' => $sec->id,
                'started_at' => now()->subMinutes(30),
                'deadline_at' => now()->subMinutes(10),
                'finished_at' => now()->subMinutes(10),
                'score' => 0,
                'score_web' => 0,
                'correct_count' => 0,
                'wrong_count' => 0,
            ]);
        }
    }

    public function test_admin_and_operator_can_view_attempt_review(): void
    {
        // Jawab 1 soal benar di section 1
        $firstSection = $this->exam->sections()->orderBy('position')->first();
        $question = Question::whereHas('group', fn ($q) => $q->where('exam_section_id', $firstSection->id))->first();
        $correctOption = $question->options()->where('is_correct', true)->first();

        AttemptAnswer::create([
            'exam_attempt_id' => $this->attempt->id,
            'question_id' => $question->id,
            'question_option_id' => $correctOption->id,
            'answered_at' => now(),
            'is_correct' => true,
            'score' => $question->points,
        ]);

        app(ScoringService::class)->score($this->attempt);

        // Operator can view
        $this->actingAs($this->operator)
            ->get(route('admin.attempts.review', [$this->exam, $this->attempt]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/exams/review')
                ->has('sections')
                ->where('participant.id', $this->participant->id)
            );

        // Admin can view
        $this->actingAs($this->admin)
            ->get(route('admin.attempts.review', [$this->exam, $this->attempt]))
            ->assertOk();
    }

    public function test_admin_can_adjust_section_score_with_addition(): void
    {
        $firstSection = $this->exam->sections()->orderBy('position')->first();
        $question = Question::whereHas('group', fn ($q) => $q->where('exam_section_id', $firstSection->id))->first();
        $correctOption = $question->options()->where('is_correct', true)->first();

        AttemptAnswer::create([
            'exam_attempt_id' => $this->attempt->id,
            'question_id' => $question->id,
            'question_option_id' => $correctOption->id,
            'answered_at' => now(),
            'is_correct' => true,
            'score' => 4,
        ]);

        app(ScoringService::class)->score($this->attempt);

        $attemptSection = AttemptSection::where('exam_attempt_id', $this->attempt->id)
            ->where('exam_section_id', $firstSection->id)
            ->first();

        $this->assertEquals(4, $attemptSection->score_web);
        $this->assertEquals(4, $attemptSection->score);
        $this->assertEquals(4, $this->attempt->fresh()->score_total);

        // Admin menambahkan nilai kertas +12
        $response = $this->actingAs($this->admin)->patch(
            route('admin.attempts.sections.adjust', [$this->exam, $this->attempt, $firstSection]),
            [
                'adjustment_type' => 'addition',
                'manual_score' => 12,
                'notes' => 'Koreksi LJK kertas no 2-3',
            ]
        );

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $attemptSection->refresh();
        $this->assertEquals(4, $attemptSection->score_web);
        $this->assertEquals('addition', $attemptSection->adjustment_type);
        $this->assertEquals(12, $attemptSection->manual_score);
        $this->assertEquals(16, $attemptSection->score); // 4 + 12
        $this->assertEquals('Koreksi LJK kertas no 2-3', $attemptSection->adjustment_notes);
        $this->assertEquals($this->admin->id, $attemptSection->adjusted_by);
        $this->assertNotNull($attemptSection->adjusted_at);

        // Pastikan total skor attempt ikut ter-update
        $this->assertEquals(16, $this->attempt->fresh()->score_total);

        // Nilai ulang (rescore) harus tetap menjaga penyesuaian manual
        app(ScoringService::class)->score($this->attempt->fresh());
        $attemptSection->refresh();
        $this->assertEquals(16, $attemptSection->score);
        $this->assertEquals(16, $this->attempt->fresh()->score_total);
    }

    public function test_admin_can_adjust_section_score_with_overwrite(): void
    {
        $firstSection = $this->exam->sections()->orderBy('position')->first();

        $attemptSection = AttemptSection::where('exam_attempt_id', $this->attempt->id)
            ->where('exam_section_id', $firstSection->id)
            ->first();

        $attemptSection->update(['score' => 10, 'score_web' => 10]);
        $this->attempt->update(['score_total' => 10]);

        // Admin overwrite nilai menjadi 50 (hasil ujian ulang)
        $response = $this->actingAs($this->admin)->patch(
            route('admin.attempts.sections.adjust', [$this->exam, $this->attempt, $firstSection]),
            [
                'adjustment_type' => 'overwrite',
                'manual_score' => 50,
                'notes' => 'Tes ulang manual',
            ]
        );

        $response->assertRedirect();

        $attemptSection->refresh();
        $this->assertEquals(10, $attemptSection->score_web); // Nilai asli web tetap utuh
        $this->assertEquals('overwrite', $attemptSection->adjustment_type);
        $this->assertEquals(50, $attemptSection->manual_score);
        $this->assertEquals(50, $attemptSection->score); // Overwrite jadi 50
        $this->assertEquals(50, $this->attempt->fresh()->score_total);
    }

    public function test_admin_can_reset_adjustment(): void
    {
        $firstSection = $this->exam->sections()->orderBy('position')->first();

        $attemptSection = AttemptSection::where('exam_attempt_id', $this->attempt->id)
            ->where('exam_section_id', $firstSection->id)
            ->first();

        $attemptSection->update([
            'score' => 20,
            'score_web' => 8,
            'adjustment_type' => 'addition',
            'manual_score' => 12,
        ]);
        $this->attempt->update(['score_total' => 20]);

        // Reset to none
        $response = $this->actingAs($this->admin)->patch(
            route('admin.attempts.sections.adjust', [$this->exam, $this->attempt, $firstSection]),
            [
                'adjustment_type' => 'none',
                'manual_score' => 0,
            ]
        );

        $response->assertRedirect();

        $attemptSection->refresh();
        $this->assertEquals(8, $attemptSection->score_web);
        $this->assertNull($attemptSection->adjustment_type);
        $this->assertEquals(0, $attemptSection->manual_score);
        $this->assertEquals(8, $attemptSection->score); // Kembali ke nilai web
        $this->assertEquals(8, $this->attempt->fresh()->score_total);
    }

    public function test_operator_cannot_adjust_section_score(): void
    {
        $firstSection = $this->exam->sections()->orderBy('position')->first();

        $this->actingAs($this->operator)->patch(
            route('admin.attempts.sections.adjust', [$this->exam, $this->attempt, $firstSection]),
            [
                'adjustment_type' => 'overwrite',
                'manual_score' => 50,
            ]
        )->assertForbidden();
    }
}
