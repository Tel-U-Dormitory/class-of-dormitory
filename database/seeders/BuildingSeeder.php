<?php

namespace Database\Seeders;

use App\Models\Building;
use Illuminate\Database\Seeder;

class BuildingSeeder extends Seeder
{
    public function run(): void
    {
        $names = [
            ...array_map(fn ($n) => "Gedung {$n}", range(1, 12)),
            ...array_map(fn ($l) => "Gedung {$l}", range('A', 'F')),
        ];

        foreach ($names as $i => $name) {
            Building::updateOrCreate(['name' => $name], ['sort_order' => $i + 1]);
        }
    }
}
