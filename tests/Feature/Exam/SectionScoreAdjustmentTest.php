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
use App\Services\Exam\CastSelectionService;
use App\Services\Exam\ScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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
                ->missing('sections')
                ->where('participant.id', $this->participant->id)
                ->loadDeferredProps(fn ($reload) => $reload
                    ->has('sections', $this->exam->sections->count())
                    ->where('sections.0.answered_count', 1)
                    ->where('sections.0.groups.0.questions.0.is_correct', true)
                )
            );

        // Admin can view
        $this->actingAs($this->admin)
            ->get(route('admin.attempts.review', [$this->exam, $this->attempt]))
            ->assertOk();
    }

    public function test_cast_availability_uses_one_existence_query_and_excludes_disqualified_attempts(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->assertTrue(app(CastSelectionService::class)->hasRanked($this->exam));
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
        $this->assertCount(1, $queries);
        $this->assertStringContainsString('exists', strtolower($queries[0]['query']));

        $this->attempt->update(['submit_reason' => SubmitReason::Disqualified]);
        $this->assertFalse(app(CastSelectionService::class)->hasRanked($this->exam));
    }

    public function test_initial_review_does_not_query_questions_or_answers(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->actingAs($this->admin)
            ->get(route('admin.attempts.review', [$this->exam, $this->attempt]))
            ->assertOk();
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
        foreach ($queries as $query) {
            $this->assertDoesNotMatchRegularExpression('/from ["`](questions|question_options|attempt_answers)["`]/i', $query['query']);
        }
    }

    public function test_results_defer_and_paginate_without_changing_global_ranks(): void
    {
        // A submitted/scored attempt has a numeric total; NULL ordering differs by database.
        $this->attempt->update(['score_total' => 0]);

        for ($i = 0; $i < 54; $i++) {
            $participant = Participant::factory()->create(['building_id' => $this->participant->building_id]);
            ExamAttempt::create([
                'exam_id' => $this->exam->id,
                'participant_id' => $participant->id,
                'status' => AttemptStatus::Submitted,
                'started_at' => now()->subMinutes(30),
                'submitted_at' => now(),
                'submit_reason' => SubmitReason::Manual,
                'score_total' => 100 - $i,
                'duration_seconds' => 1800,
            ]);
        }

        $this->actingAs($this->admin)
            ->get(route('admin.exams.results', [$this->exam, 'page' => 2, 'building' => $this->participant->building_id]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->missing('results')
                ->loadDeferredProps(fn ($reload) => $reload
                    ->has('results.rows', 5)
                    ->where('results.page', 2)
                    ->where('results.total', 55)
                    ->where('results.cohort_total', 55)
                    ->where('results.rows.0.rank', 51)
                    ->where('results.rows.0.building_rank', 51)
                    ->where('results.rows.4.attempt_id', $this->attempt->id)
                    ->where('results.rows.4.section_scores.'.$this->exam->sections->first()->id, 0)
                )
            );
    }

    public function test_progressive_batch_endpoints_return_paginated_json_chunks(): void
    {
        $this->attempt->update(['score_total' => 40]);

        for ($i = 0; $i < 4; $i++) {
            $p = Participant::factory()->create(['building_id' => $this->participant->building_id]);
            ExamAttempt::create([
                'exam_id' => $this->exam->id,
                'participant_id' => $p->id,
                'status' => AttemptStatus::Submitted,
                'started_at' => now()->subMinutes(30),
                'submitted_at' => now(),
                'submit_reason' => SubmitReason::Manual,
                'score_total' => 80 - ($i * 10),
                'duration_seconds' => 1500,
            ]);
        }

        // Batch endpoint for participants
        $this->actingAs($this->admin)
            ->getJson(route('admin.participants.index', ['batch_page' => 1, 'batch_size' => 25]))
            ->assertOk()
            ->assertJsonStructure(['rows', 'page', 'has_more', 'total'])
            ->assertJsonPath('total', 5)
            ->assertJsonPath('has_more', false);

        // Batch endpoint for exam results
        $this->actingAs($this->admin)
            ->getJson(route('admin.exams.results', [$this->exam, 'batch_page' => 1, 'batch_size' => 25]))
            ->assertOk()
            ->assertJsonStructure(['rows', 'page', 'has_more', 'total'])
            ->assertJsonPath('total', 5)
            ->assertJsonPath('rows.0.rank', 1)
            ->assertJsonPath('has_more', false);
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
