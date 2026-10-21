<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status')->default('draft')->index();
            $table->timestamp('scheduled_at')->nullable();
            $table->unsignedInteger('break_seconds')->default(300);
            $table->text('announcement')->nullable();
            $table->timestamp('results_published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('exam_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->string('pillar');
            $table->unsignedTinyInteger('position');
            $table->unsignedInteger('duration_seconds')->default(1800);
            $table->text('instructions')->nullable();
            $table->timestamps();

            $table->unique(['exam_id', 'pillar']);
            $table->unique(['exam_id', 'position']);
        });

        Schema::create('question_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_section_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('kind')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('stimulus_type')->default('none');
            $table->longText('stimulus_text')->nullable();
            $table->string('stimulus_media_path')->nullable();
            $table->json('stimulus_slides')->nullable();
            $table->unsignedSmallInteger('stimulus_duration_seconds')->nullable();
            $table->timestamps();

            $table->index(['exam_section_id', 'position']);
        });

        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_group_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->text('body');
            $table->boolean('is_latex')->default(false);
            $table->string('image_path')->nullable();
            $table->boolean('options_are_images')->default(false);
            $table->smallInteger('points')->default(4);
            $table->smallInteger('penalty')->default(1);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['question_group_id', 'is_active', 'position']);
        });

        Schema::create('question_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('position');
            $table->text('content');
            $table->boolean('is_correct')->default(false);
            $table->timestamps();

            $table->unique(['question_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('question_options');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('question_groups');
        Schema::dropIfExists('exam_sections');
        Schema::dropIfExists('exams');
    }
};
