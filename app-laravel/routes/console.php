<?php

use App\Enums\AttemptStatus;
use App\Enums\UserRole;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Services\Exam\ExamEngine;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('exam:sync-attempts', function (ExamEngine $engine) {
    $count = 0;

    ExamAttempt::whereIn('status', [AttemptStatus::InProgress, AttemptStatus::OnBreak])
        ->lazyById()
        ->each(function (ExamAttempt $attempt) use ($engine, &$count) {
            $before = $attempt->status;
            $after = $engine->sync($attempt);
            $count += $before !== $after->status || $after->current_section_id !== $attempt->current_section_id ? 1 : 0;
        });

    $this->info("{$count} attempt berpindah status.");
})->purpose('Tutup pilar yang melewati tenggat dan kirim ujian yang waktunya habis, walau peserta offline');

Schedule::command('exam:sync-attempts')->everyMinute()->withoutOverlapping();

Artisan::command('cod:create-admin {email} {name} {--operator}', function (string $email, string $name) {
    $password = $this->secret('Password');

    $user = User::updateOrCreate(['email' => $email], [
        'name' => $name,
        'password' => $password,
        'role' => $this->option('operator') ? UserRole::Operator : UserRole::Admin,
        'email_verified_at' => now(),
    ]);

    $this->info("Akun {$user->role->label()} {$user->email} siap.");
})->purpose('Buat atau perbarui akun panitia');
