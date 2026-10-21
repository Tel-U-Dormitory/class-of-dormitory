<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ExamController;
use App\Http\Controllers\Admin\MediaController;
use App\Http\Controllers\Admin\MonitorController;
use App\Http\Controllers\Admin\ParticipantController;
use App\Http\Controllers\Admin\QuestionController;
use App\Http\Controllers\Admin\QuestionGroupController;
use App\Http\Controllers\Admin\ResultController;
use App\Http\Controllers\Admin\SectionController;
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
        });
    });
});
