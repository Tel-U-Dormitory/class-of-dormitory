<?php

namespace Database\Factories;

use App\Enums\ParticipantStatus;
use App\Models\Building;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<\App\Models\Participant>
 */
class ParticipantFactory extends Factory
{
    public const TOKEN = 'TEST-TOKN';

    private static ?string $tokenHash = null;

    public function definition(): array
    {
        return [
            'building_id' => Building::query()->inRandomOrder()->value('id') ?? Building::create(['name' => 'Gedung '.fake()->unique()->numberBetween(1, 99)])->id,
            'full_name' => fake()->name(),
            'nim' => (string) fake()->unique()->numerify('1352####'),
            'email' => fake()->unique()->safeEmail(),
            'room_number' => (string) fake()->numberBetween(101, 520),
            'major' => fake()->randomElement(['Teknik Informatika', 'Matematika', 'Fisika', 'Teknik Sipil', 'Farmasi', 'Desain Komunikasi Visual']),
            'status' => ParticipantStatus::Registered,
            'token_hash' => self::$tokenHash ??= Hash::make(self::TOKEN),
            'token_issued_at' => now(),
        ];
    }
}
