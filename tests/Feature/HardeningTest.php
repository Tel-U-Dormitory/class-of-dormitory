<?php

namespace Tests\Feature;

use App\Enums\AttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\UserRole;
use App\Http\Middleware\EnsureSingleParticipantSession;
use App\Models\Building;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Participant;
use App\Models\Question;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class HardeningTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => UserRole::Admin]);
    }

    public function test_closed_registration_rejects_new_participants(): void
    {
        Storage::fake('local');
        $building = Building::create(['name' => 'Gedung 1']);

        $this->actingAs($this->admin())->put(route('admin.registration.update'), ['open' => false, 'closed_message' => 'Tutup dulu ya.']);
        $this->assertFalse(Settings::registrationOpen());

        $this->get(route('participant.register'))->assertInertia(fn ($page) => $page->where('closedMessage', 'Tutup dulu ya.'));

        $this->post(route('participant.register'), [
            'full_name' => 'Telat Daftar',
            'nim' => '13529999',
            'email' => 'telat@example.test',
            'building_id' => $building->id,
            'room_number' => '101',
            'major' => 'Fisika',
            'photo' => UploadedFile::fake()->image('a.jpg'),
            'agreement' => true,
        ])->assertSessionHas('error');

        $this->assertDatabaseMissing('participants', ['nim' => '13529999']);
    }

    public function test_validation_messages_are_in_indonesian(): void
    {
        $this->post(route('participant.login'), ['nim' => '', 'token' => ''])->assertSessionHasErrors(['nim' => 'NIM wajib diisi.']);
    }

    public function test_question_bank_is_locked_while_exam_is_open(): void
    {
        $exam = Exam::factory()->withQuestions(1)->create(['status' => ExamStatus::Open]);
        $question = Question::first();
        $admin = $this->admin();

        $this->actingAs($admin)->put(route('admin.questions.update', $question), [
            'body' => 'Diubah', 'points' => 10, 'penalty' => 0, 'correct_option' => 1,
            'options' => [['content' => 'a'], ['content' => 'b']],
        ])->assertSessionHas('error');
        $this->assertSame(4, $question->fresh()->points);

        // Ujian ditutup tetapi masih ada peserta yang mengerjakan: tetap terkunci.
        $exam->update(['status' => ExamStatus::Closed]);
        ExamAttempt::create(['exam_id' => $exam->id, 'participant_id' => Participant::factory()->create()->id, 'status' => AttemptStatus::InProgress, 'started_at' => now()]);
        $this->delete(route('admin.questions.destroy', $question))->assertSessionHas('error');
        $this->assertNotNull($question->fresh());
    }

    public function test_rescore_applies_corrected_answer_key(): void
    {
        $this->withoutMiddleware(EnsureSingleParticipantSession::class);
        $exam = Exam::factory()->withQuestions(1, 600)->create(['break_seconds' => 0]);
        $participant = Participant::factory()->create();
        $memory = $exam->sections()->first()->groups()->first();
        $question = $memory->questions()->first();
        $wrong = $question->options()->where('is_correct', false)->first();

        $this->actingAs($participant, 'participant')->post(route('exam.start'));
        $this->post(route('exam.observation.start', $memory));
        $this->post(route('exam.observation.finish', $memory));
        $this->postJson(route('exam.answer', $question), ['option_id' => $wrong->id])->assertOk();
        foreach (range(1, 4) as $_) {
            $this->post(route('exam.section.finish'));
        }

        $attempt = ExamAttempt::first();
        $this->assertSame(-1, $attempt->score_total);

        // Panitia menemukan kunci salah: opsi yang dipilih peserta ternyata benar.
        $exam->update(['status' => ExamStatus::Closed]);
        $question->options()->update(['is_correct' => false]);
        $wrong->update(['is_correct' => true]);

        $this->actingAs($this->admin())->post(route('admin.exams.rescore', $exam))->assertSessionHas('success');
        $this->assertSame(4, $attempt->fresh()->score_total);
    }

    public function test_admin_manages_panel_accounts_but_keeps_one_admin(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);

        $this->post(route('admin.users.store'), ['name' => 'Op', 'email' => 'op@cod.test', 'role' => 'operator', 'password' => 'rahasia-panjang'])->assertSessionHas('success');
        $operator = User::firstWhere('email', 'op@cod.test');
        $this->assertSame(UserRole::Operator, $operator->role);

        $this->put(route('admin.users.update', $admin), ['name' => $admin->name, 'email' => $admin->email, 'role' => 'operator'])->assertSessionHas('error');
        $this->delete(route('admin.users.destroy', $admin))->assertSessionHas('error');

        $this->actingAs($operator)->get(route('admin.users.index'))->assertForbidden();
    }

    public function test_answer_rate_limit_is_per_participant_not_per_ip(): void
    {
        $this->withoutMiddleware(EnsureSingleParticipantSession::class);
        Exam::factory()->withQuestions(1)->create();
        [$a, $b] = Participant::factory()->count(2)->create();

        // Peserta A menghabiskan kuota heartbeat dari IP yang sama dengan peserta B.
        $this->actingAs($a, 'participant')->post(route('exam.start'));
        foreach (range(1, 30) as $_) {
            $this->postJson(route('exam.heartbeat'))->assertOk();
        }
        $this->postJson(route('exam.heartbeat'))->assertStatus(429);

        $this->actingAs($b, 'participant')->post(route('exam.start'));
        $this->postJson(route('exam.heartbeat'))->assertOk();
    }
}
