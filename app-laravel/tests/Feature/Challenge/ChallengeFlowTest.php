<?php

namespace Tests\Feature\Challenge;

use App\Enums\ParticipantStatus;
use App\Enums\UserRole;
use App\Models\Challenge;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChallengeFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $operator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->operator = User::factory()->create(['role' => UserRole::Operator]);
    }

    private function cast(int $count = 3)
    {
        return Participant::factory()->count($count)->create(['status' => ParticipantStatus::CastSelected]);
    }

    public function test_arena_requires_staff_login(): void
    {
        $challenge = Challenge::factory()->active()->create();

        $this->get(route('arena.show', $challenge))->assertRedirect(route('login'));
        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => 1, 'answer' => '1'])->assertUnauthorized();
    }

    public function test_arena_page_never_exposes_answer_key(): void
    {
        $this->cast();
        $challenge = Challenge::factory()->active()->create(['answer_key' => 'RAHASIA-9137']);

        $response = $this->actingAs($this->operator)->get(route('arena.show', $challenge));

        $response->assertOk();
        $this->assertStringNotContainsString('RAHASIA-9137', $response->getContent());
        $this->assertStringNotContainsString('answer_key', $response->getContent());
    }

    public function test_single_attempt_game_scores_on_server(): void
    {
        [$a, $b] = $this->cast(2);
        $challenge = Challenge::factory()->active()->create(['answer_key' => '1234', 'max_attempts' => 1]);

        $this->actingAs($this->operator)
            ->postJson(route('arena.submit', $challenge), ['entrant_id' => $a->id, 'answer' => '1234'])
            ->assertOk()->assertJson(['correct' => true]);

        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $b->id, 'answer' => '9999'])
            ->assertOk()->assertJson(['correct' => false, 'attempts_left' => 0]);

        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $b->id, 'answer' => '1234'])->assertStatus(422);
        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $a->id, 'answer' => '1234'])->assertStatus(422);
    }

    public function test_numerical_odyssey_allows_retries_until_correct(): void
    {
        [$a] = $this->cast(1);
        $challenge = Challenge::factory()->active()->odyssey()->create();

        $this->actingAs($this->operator);

        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $a->id, 'tokens' => ['6', '×', '3']])
            ->assertOk()->assertJson(['correct' => false]);
        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $a->id, 'tokens' => ['2', '4']])
            ->assertOk()->assertJson(['correct' => false, 'message' => 'Angka tidak boleh digabung menjadi bilangan dua digit.']);
        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $a->id, 'tokens' => ['6', '×', '4']])
            ->assertOk()->assertJson(['correct' => true, 'message' => '6×4 = 24']);

        $this->assertSame(3, $challenge->submissions()->count());
    }

    public function test_locked_game_and_outsiders_are_rejected(): void
    {
        [$a] = $this->cast(1);
        $outsider = Participant::factory()->create(['status' => ParticipantStatus::Eliminated]);
        $locked = Challenge::factory()->create();
        $active = Challenge::factory()->active()->create();

        $this->actingAs($this->operator);
        $this->postJson(route('arena.submit', $locked), ['entrant_id' => $a->id, 'answer' => '1234'])->assertStatus(422);
        $this->postJson(route('arena.submit', $active), ['entrant_id' => $outsider->id, 'answer' => '1234'])->assertStatus(422);
    }

    public function test_invites_restrict_the_roster(): void
    {
        [$a, $b] = $this->cast(2);
        $challenge = Challenge::factory()->active()->create();
        $challenge->invitees()->attach($a);

        $this->actingAs($this->operator);
        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $b->id, 'answer' => '1234'])->assertStatus(422);
        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $a->id, 'answer' => '1234'])->assertOk();
    }

    public function test_bracket_advances_fastest_and_moves_the_rest(): void
    {
        [$first, $second, $slow, $absent] = $this->cast(4);
        $challenge = Challenge::factory()->active()->create(['answer_key' => '7', 'max_attempts' => 3]);
        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $this->actingAs($this->operator);
        $this->freezeTime(function () use ($challenge, $first, $second, $slow) {
            $this->travel(5)->seconds();
            $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $second->id, 'answer' => '1']);
            $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $first->id, 'answer' => '7']);
            $this->travel(5)->seconds();
            $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $second->id, 'answer' => '7']);
            $this->travel(5)->seconds();
            $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $slow->id, 'answer' => '7']);
        });

        $this->actingAs($admin)
            ->post(route('admin.challenges.bracket', $challenge), ['max_winners' => 2, 'failed_status' => 'deathmatch'])
            ->assertSessionHas('success');

        $this->assertSame(ParticipantStatus::Advanced, $first->fresh()->status);
        $this->assertSame(ParticipantStatus::Advanced, $second->fresh()->status);
        $this->assertSame(ParticipantStatus::Deathmatch, $slow->fresh()->status);
        $this->assertSame(ParticipantStatus::Deathmatch, $absent->fresh()->status);
    }

    public function test_team_mode_submits_as_team_and_advances_members(): void
    {
        [$a, $b, $c] = $this->cast(3);
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $challenge = Challenge::factory()->active()->create(['competition_mode' => 'team', 'max_winners' => 1]);

        $this->actingAs($admin)->post(route('admin.teams.store', $challenge), ['name' => 'Gedung Merah', 'member_ids' => [$a->id, $b->id]]);
        $this->post(route('admin.teams.store', $challenge), ['name' => 'Gedung Biru', 'member_ids' => [$b->id, $c->id]])->assertSessionHasErrors('member_ids');
        $this->post(route('admin.teams.store', $challenge), ['name' => 'Gedung Biru', 'member_ids' => [$c->id]]);

        $red = $challenge->teams()->firstWhere('name', 'Gedung Merah');
        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $red->id, 'answer' => '1234'])->assertOk()->assertJson(['correct' => true]);
        $this->postJson(route('arena.submit', $challenge), ['entrant_id' => $a->id, 'answer' => '1234'])->assertNotFound();

        $this->post(route('admin.challenges.bracket', $challenge), ['max_winners' => 1, 'failed_status' => 'eliminated']);

        $this->assertSame(ParticipantStatus::Advanced, $a->fresh()->status);
        $this->assertSame(ParticipantStatus::Advanced, $b->fresh()->status);
        $this->assertSame(ParticipantStatus::Eliminated, $c->fresh()->status);
    }

    public function test_operator_cannot_manage_challenges(): void
    {
        $challenge = Challenge::factory()->create();

        $this->actingAs($this->operator)->get(route('admin.challenges.index'))->assertForbidden();
        $this->patch(route('admin.challenges.status', $challenge), ['status' => 'active'])->assertForbidden();
    }
}
