<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(BuildingSeeder::class);

        if (! app()->environment('local', 'testing')) {
            $this->command?->warn('Lewati data demo. Buat akun panitia dengan: php artisan cod:create-admin');

            return;
        }

        // Akun demo khusus pengembangan lokal.
        // Admin    : admin@cod.test / password
        // Operator : operator@cod.test / password
        // Peserta  : NIM 13520001 s.d. 13520030, token TEST-TOKN (ParticipantFactory::TOKEN)
        User::factory()->create(['name' => 'Admin CoD', 'email' => 'admin@cod.test', 'role' => UserRole::Admin]);
        User::factory()->create(['name' => 'Operator CoD', 'email' => 'operator@cod.test', 'role' => UserRole::Operator]);

        foreach (range(1, 30) as $i) {
            Participant::factory()->create(['nim' => sprintf('135200%02d', $i)]);
        }

        $this->call(SampleExamSeeder::class);

        if (app()->environment('local')) {
            $this->call(DemoResultsSeeder::class);
        }
    }
}
