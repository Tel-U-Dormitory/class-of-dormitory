<?php

use App\Http\Controllers\Arena\ArenaController;
use App\Http\Controllers\Exam\AnswerController;
use App\Http\Controllers\Exam\LobbyController;
use App\Http\Controllers\Exam\MediaController;
use App\Http\Controllers\Exam\ObservationController;
use App\Http\Controllers\Exam\SessionController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\Participant\AuthController;
use App\Http\Controllers\Participant\DashboardController;
use App\Http\Controllers\Participant\RegistrationController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

// Peserta: pendaftaran & login (token).
Route::middleware('guest:participant')->group(function () {
    Route::get('daftar', [RegistrationController::class, 'create'])->name('participant.register');
    Route::post('daftar', [RegistrationController::class, 'store'])->middleware('throttle:10,1');
    Route::get('masuk', [AuthController::class, 'create'])->name('participant.login');
    Route::post('masuk', [AuthController::class, 'store']);
});

Route::get('daftar/berhasil', [RegistrationController::class, 'registered'])->name('participant.registered');

Route::middleware(['auth:participant', 'participant.single-session'])->group(function () {
    Route::post('keluar', [AuthController::class, 'destroy'])->name('participant.logout');
    Route::get('peserta', DashboardController::class)->name('participant.dashboard');
    Route::get('peserta/foto', [DashboardController::class, 'photo'])->name('participant.photo');

    Route::prefix('ujian')->name('exam.')->group(function () {
        Route::get('/', [LobbyController::class, 'show'])->name('lobby');
        Route::post('mulai', [LobbyController::class, 'start'])->name('start');
        Route::get('sesi', [SessionController::class, 'show'])->name('session');
        Route::post('pilar/selesai', [SessionController::class, 'finishSection'])->name('section.finish');
        Route::post('jeda/lewati', [SessionController::class, 'skipBreak'])->name('break.skip');
        Route::get('selesai', [SessionController::class, 'finished'])->name('finished');

        Route::post('observasi/{group}/mulai', [ObservationController::class, 'start'])->name('observation.start');
        Route::post('observasi/{group}/selesai', [ObservationController::class, 'finish'])->name('observation.finish');

        Route::post('jawaban/{question}', [AnswerController::class, 'store'])->middleware('throttle:120,1')->name('answer');
        Route::post('event', [AnswerController::class, 'event'])->middleware('throttle:60,1')->name('event');
        Route::post('heartbeat', [AnswerController::class, 'heartbeat'])->middleware('throttle:30,1')->name('heartbeat');

        Route::get('media/stimulus/{group}', [MediaController::class, 'stimulus'])->name('media.stimulus');
        Route::get('media/slide/{group}/{index}', [MediaController::class, 'slide'])->whereNumber('index')->name('media.slide');
        Route::get('media/soal/{question}', [MediaController::class, 'question'])->name('media.question');
        Route::get('media/opsi/{option}', [MediaController::class, 'option'])->name('media.option');
    });
});

// Layar game panggung: hanya bisa dibuka panitia yang login.
Route::middleware('auth')->prefix('arena')->name('arena.')->group(function () {
    Route::get('{challenge}', [ArenaController::class, 'show'])->name('show');
    Route::post('{challenge}/jawab', [ArenaController::class, 'submit'])->middleware('throttle:120,1')->name('submit');
});

Route::prefix('admin')->group(function () {
    require __DIR__.'/admin.php';
    require __DIR__.'/settings.php';
    require __DIR__.'/auth.php';
});
