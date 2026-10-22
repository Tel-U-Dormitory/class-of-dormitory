<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->foreignId('participant_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('in_progress')->index();
            $table->foreignId('current_section_id')->nullable()->constrained('exam_sections')->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('break_ends_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->string('submit_reason')->nullable();
            $table->unsignedInteger('tab_switch_count')->default(0);
            $table->timestamp('last_seen_at')->nullable();
            $table->integer('score_total')->nullable();
            $table->unsignedSmallInteger('correct_count')->nullable();
            $table->unsignedSmallInteger('wrong_count')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->timestamps();

            $table->unique(['exam_id', 'participant_id']);
            $table->index(['exam_id', 'score_total']);
        });

        Schema::create('attempt_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exam_section_id')->constrained()->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('deadline_at');
            $table->timestamp('finished_at')->nullable();
            $table->integer('score')->nullable();
            $table->unsignedSmallInteger('correct_count')->nullable();
            $table->unsignedSmallInteger('wrong_count')->nullable();
            $table->timestamps();

            $table->unique(['exam_attempt_id', 'exam_section_id']);
        });

        Schema::create('attempt_observations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_group_id')->constrained()->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ends_at');
            $table->timestamps();

            $table->unique(['exam_attempt_id', 'question_group_id']);
        });

        Schema::create('attempt_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_option_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('answered_at');
            $table->boolean('is_correct')->nullable();
            $table->smallInteger('score')->nullable();
            $table->timestamps();

            $table->unique(['exam_attempt_id', 'question_id']);
        });

        Schema::create('attempt_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['exam_attempt_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attempt_events');
        Schema::dropIfExists('attempt_answers');
        Schema::dropIfExists('attempt_observations');
        Schema::dropIfExists('attempt_sections');
        Schema::dropIfExists('exam_attempts');
    }
};
