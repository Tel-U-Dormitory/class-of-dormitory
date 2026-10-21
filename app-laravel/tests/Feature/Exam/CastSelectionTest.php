<?php

namespace Tests\Feature\Exam;

use App\Enums\AttemptStatus;
use App\Enums\ParticipantStatus;
use App\Enums\SubmitReason;
use App\Enums\UserRole;
use App\Models\Building;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CastSelectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_top_global_are_kept_and_each_building_takes_its_best_from_the_rest(): void
    {
        config(['exam.cast' => ['global_keep' => 2, 'per_building' => 1]]);

        $exam = Exam::factory()->create();
        $north = Building::create(['name' => 'Gedung Utara']);
        $south = Building::create(['name' => 'Gedung Selatan']);

        $make = function (Building $building, int $score, int $duration = 100, ?SubmitReason $reason = null) use ($exam) {
            $participant = Participant::factory()->create(['building_id' => $building->id, 'status' => ParticipantStatus::Submitted]);

            ExamAttempt::create([
                'exam_id' => $exam->id,
                'participant_id' => $participant->id,
                'status' => AttemptStatus::Submitted,
                'started_at' => now(),
                'submitted_at' => now(),
                'submit_reason' => $reason ?? SubmitReason::Manual,
                'score_total' => $score,
                'duration_seconds' => $duration,
            ]);

            return $participant;
        };

        $n1 = $make($north, 90);
        $n2 = $make($north, 80);
        $n3 = $make($north, 70, 50);
        $n4 = $make($north, 70, 60);
        $s1 = $make($south, 60);
        $s2 = $make($south, 99, 10, SubmitReason::Disqualified);

        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $this->actingAs($admin)->post(route('admin.exams.cast.apply', $exam))->assertSessionHas('success');

        // Global: n1, n2. Utara dari sisa: n3 (seri skor, lebih cepat). Selatan: s1. Diskualifikasi diabaikan.
        foreach ([$n1, $n2, $n3, $s1] as $p) {
            $this->assertSame(ParticipantStatus::CastSelected, $p->fresh()->status, $p->full_name);
        }
        $this->assertSame(ParticipantStatus::Submitted, $n4->fresh()->status);
        $this->assertSame(ParticipantStatus::Submitted, $s2->fresh()->status);
        $this->assertSame('global', ExamAttempt::firstWhere('participant_id', $n1->id)->cast_type);
        $this->assertSame('building', ExamAttempt::firstWhere('participant_id', $n3->id)->cast_type);

        $this->get(route('admin.exams.cast-reveal', $exam))->assertOk();
    }
}
