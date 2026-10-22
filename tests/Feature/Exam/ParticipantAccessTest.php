<?php

namespace Tests\Feature\Exam;

use App\Enums\UserRole;
use App\Models\Building;
use App\Models\Exam;
use App\Models\Participant;
use App\Models\User;
use Database\Factories\ParticipantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ParticipantAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_issues_a_hashed_token_shown_once(): void
    {
        Storage::fake('local');
        $building = Building::create(['name' => 'Gedung 1']);

        $response = $this->post(route('participant.register'), [
            'full_name' => 'Rani Putri',
            'nim' => '13521999',
            'email' => 'rani@example.test',
            'building_id' => $building->id,
            'room_number' => '204',
            'major' => 'Matematika',
            'photo' => UploadedFile::fake()->image('foto.jpg'),
            'achievements' => ['Juara 1 OSN', '', ''],
            'agreement' => true,
        ]);

        $response->assertRedirect(route('participant.registered'));
        $token = session('registration')['token'];
        $participant = Participant::firstWhere('nim', '13521999');

        $this->assertMatchesRegularExpression('/^[A-Z0-9]{4}-[A-Z0-9]{4}$/', $token);
        $this->assertNotSame($token, $participant->token_hash);
        $this->assertTrue($participant->checkToken(strtolower(str_replace('-', '', $token))));
        $this->assertSame(['Juara 1 OSN'], $participant->achievements);
        Storage::disk('local')->assertExists($participant->photo_path);
    }

    public function test_duplicate_nim_is_rejected(): void
    {
        Participant::factory()->create(['nim' => '13521000']);

        $this->post(route('participant.register'), ['nim' => '13521000'])->assertSessionHasErrors('nim');
    }

    public function test_login_with_nim_and_token(): void
    {
        $participant = Participant::factory()->create();

        $this->post(route('participant.login'), ['nim' => $participant->nim, 'token' => 'salah-token'])
            ->assertSessionHasErrors('token');
        $this->assertGuest('participant');

        $this->post(route('participant.login'), ['nim' => $participant->nim, 'token' => ParticipantFactory::TOKEN])
            ->assertRedirect(route('participant.dashboard'));
        $this->assertAuthenticatedAs($participant, 'participant');
    }

    public function test_new_login_kicks_previous_session(): void
    {
        $participant = Participant::factory()->create();
        $this->actingAs($participant, 'participant');
        $participant->forceFill(['current_session_id' => 'sesi-perangkat-lain'])->save();

        $this->get(route('participant.dashboard'))->assertRedirect(route('participant.login'));
        $this->assertGuest('participant');
    }

    public function test_exam_pages_require_participant_login(): void
    {
        $this->get(route('exam.lobby'))->assertRedirect(route('participant.login'));
        $this->get(route('dashboard'))->assertRedirect(route('login'));
    }

    public function test_operator_cannot_edit_question_bank(): void
    {
        $exam = Exam::factory()->withQuestions(1)->create();
        $operator = User::factory()->create(['role' => UserRole::Operator]);
        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $this->actingAs($operator)->get(route('admin.exams.monitor', $exam))->assertOk();
        $this->actingAs($operator)->get(route('admin.sections.show', $exam->sections->first()))->assertForbidden();
        $this->actingAs($admin)->get(route('admin.sections.show', $exam->sections->first()))->assertOk();
    }
}
