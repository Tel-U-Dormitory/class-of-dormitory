<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('challenges', function (Blueprint $table) {
            $table->id();
            $table->string('code', 60)->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('chapter')->default(1);
            $table->string('game_type');
            $table->string('competition_mode')->default('individual');
            $table->boolean('is_deathmatch')->default(false);
            $table->string('answer_key');
            $table->unsignedSmallInteger('max_winners')->default(5);
            $table->unsignedSmallInteger('max_attempts')->nullable();
            $table->string('status')->default('locked')->index();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('challenge_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();

            $table->unique(['challenge_id', 'name']);
        });

        Schema::create('team_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('participant_id')->constrained()->cascadeOnDelete();

            $table->unique(['team_id', 'participant_id']);
        });

        Schema::create('challenge_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('challenge_id')->constrained()->cascadeOnDelete();
            $table->foreignId('participant_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['challenge_id', 'participant_id']);
        });

        Schema::create('challenge_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('challenge_id')->constrained()->cascadeOnDelete();
            $table->foreignId('participant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('answer', 500);
            $table->boolean('is_correct');
            $table->unsignedInteger('elapsed_ms');
            $table->timestamp('created_at', 3)->useCurrent();

            $table->index(['challenge_id', 'is_correct', 'elapsed_ms']);
            $table->index(['challenge_id', 'participant_id']);
            $table->index(['challenge_id', 'team_id']);
        });

        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->string('cast_type')->nullable()->after('duration_seconds');
            $table->string('specialist_pillar')->nullable()->after('cast_type');
        });
    }

    public function down(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->dropColumn(['cast_type', 'specialist_pillar']);
        });

        Schema::dropIfExists('challenge_submissions');
        Schema::dropIfExists('challenge_invites');
        Schema::dropIfExists('team_members');
        Schema::dropIfExists('teams');
        Schema::dropIfExists('challenges');
    }
};
