<?php

namespace Database\Factories;

use App\Enums\ChallengeStatus;
use App\Enums\GameType;
use App\Models\Challenge;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Challenge>
 */
class ChallengeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->slug(2, false),
            'title' => 'Game '.fake()->word(),
            'chapter' => 1,
            'game_type' => GameType::NumericKeypad,
            'answer_key' => '1234',
            'max_winners' => 2,
            'max_attempts' => 1,
            'status' => ChallengeStatus::Locked,
        ];
    }

    public function active(): static
    {
        return $this->state(['status' => ChallengeStatus::Active, 'opened_at' => now()]);
    }

    public function odyssey(): static
    {
        return $this->state(['game_type' => GameType::NumericalOdyssey, 'answer_key' => '24', 'max_attempts' => null]);
    }
}
