<?php

use App\Http\Controllers\Admin\BracketController;
use App\Http\Controllers\Admin\CastController;
use App\Http\Controllers\Admin\ChallengeController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ExamController;
use App\Http\Controllers\Admin\MediaController;
use App\Http\Controllers\Admin\MonitorController;
use App\Http\Controllers\Admin\ParticipantController;
use App\Http\Controllers\Admin\QuestionController;
use App\Http\Controllers\Admin\QuestionGroupController;
use App\Http\Controllers\Admin\ResultController;
use App\Http\Controllers\Admin\SectionController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/', DashboardController::class)->name('dashboard');

    Route::name('admin.')->group(function () {
        // Operator & admin: pemantauan dan data peserta.
        Route::get('peserta', [ParticipantController::class, 'index'])->name('participants.index');
        Route::get('peserta/{participant}', [ParticipantController::class, 'show'])->name('participants.show');
        Route::get('peserta/{participant}/foto', [MediaController::class, 'participantPhoto'])->name('participants.photo');

        Route::get('ujian/{exam}/monitor', [MonitorController::class, 'show'])->name('exams.monitor');
        Route::get('ujian/{exam}/hasil', [ResultController::class, 'index'])->name('exams.results');
        Route::get('ujian/{exam}/hasil/export', [ResultController::class, 'export'])->name('exams.results.export');
        Route::get('ujian/{exam}/cast-reveal', [CastController::class, 'reveal'])->name('exams.cast-reveal');

        Route::get('bracket', BracketController::class)->name('bracket');

        // Khusus admin: perubahan data.
        Route::middleware('admin')->group(function () {
            Route::post('peserta/{participant}/reset-token', [ParticipantController::class, 'resetToken'])->name('participants.reset-token');
            Route::patch('peserta/{participant}/status', [ParticipantController::class, 'updateStatus'])->name('participants.status');
            Route::delete('peserta/{participant}', [ParticipantController::class, 'destroy'])->name('participants.destroy');

            Route::get('ujian', [ExamController::class, 'index'])->name('exams.index');
            Route::post('ujian', [ExamController::class, 'store'])->name('exams.store');
            Route::get('ujian/{exam}', [ExamController::class, 'edit'])->name('exams.edit');
            Route::put('ujian/{exam}', [ExamController::class, 'update'])->name('exams.update');
            Route::patch('ujian/{exam}/status', [ExamController::class, 'updateStatus'])->name('exams.status');
            Route::patch('ujian/{exam}/publikasi', [ExamController::class, 'togglePublish'])->name('exams.publish');
            Route::post('ujian/{exam}/nilai-ulang', [ExamController::class, 'rescore'])->name('exams.rescore');
            Route::delete('ujian/{exam}', [ExamController::class, 'destroy'])->name('exams.destroy');

            Route::post('ujian/{exam}/attempt/{attempt}/hentikan', [MonitorController::class, 'forceSubmit'])->name('attempts.force-submit');
            Route::post('ujian/{exam}/attempt/{attempt}/tambah-waktu', [MonitorController::class, 'extend'])->name('attempts.extend');

            Route::get('pilar/{section}', [SectionController::class, 'show'])->name('sections.show');
            Route::post('pilar/{section}/grup', [QuestionGroupController::class, 'store'])->name('groups.store');
            Route::put('grup/{group}', [QuestionGroupController::class, 'update'])->name('groups.update');
            Route::delete('grup/{group}', [QuestionGroupController::class, 'destroy'])->name('groups.destroy');

            Route::post('grup/{group}/soal', [QuestionController::class, 'store'])->name('questions.store');
            Route::put('soal/{question}', [QuestionController::class, 'update'])->name('questions.update');
            Route::delete('soal/{question}', [QuestionController::class, 'destroy'])->name('questions.destroy');

            Route::get('media', [MediaController::class, 'show'])->name('media');
            Route::put('pendaftaran', [DashboardController::class, 'updateRegistration'])->name('registration.update');

            Route::get('panitia', [UserController::class, 'index'])->name('users.index');
            Route::post('panitia', [UserController::class, 'store'])->name('users.store');
            Route::put('panitia/{user}', [UserController::class, 'update'])->name('users.update');
            Route::delete('panitia/{user}', [UserController::class, 'destroy'])->name('users.destroy');

            Route::post('ujian/{exam}/tetapkan-cast', [CastController::class, 'apply'])->name('exams.cast.apply');
            Route::patch('ujian/{exam}/attempt/{attempt}/spesialis', [ResultController::class, 'specialist'])->name('attempts.specialist');

            Route::get('challenge', [ChallengeController::class, 'index'])->name('challenges.index');
            Route::post('challenge', [ChallengeController::class, 'store'])->name('challenges.store');
            Route::get('challenge/{challenge}', [ChallengeController::class, 'show'])->name('challenges.show');
            Route::put('challenge/{challenge}', [ChallengeController::class, 'update'])->name('challenges.update');
            Route::delete('challenge/{challenge}', [ChallengeController::class, 'destroy'])->name('challenges.destroy');
            Route::patch('challenge/{challenge}/status', [ChallengeController::class, 'updateStatus'])->name('challenges.status');
            Route::post('challenge/{challenge}/reset', [ChallengeController::class, 'reset'])->name('challenges.reset');
            Route::put('challenge/{challenge}/roster', [ChallengeController::class, 'updateRoster'])->name('challenges.roster');
            Route::post('challenge/{challenge}/bracket', [ChallengeController::class, 'processBracket'])->name('challenges.bracket');
            Route::post('challenge/{challenge}/kelompok', [ChallengeController::class, 'storeTeam'])->name('teams.store');
            Route::put('kelompok/{team}', [ChallengeController::class, 'updateTeam'])->name('teams.update');
            Route::delete('kelompok/{team}', [ChallengeController::class, 'destroyTeam'])->name('teams.destroy');
        });
    });
});
