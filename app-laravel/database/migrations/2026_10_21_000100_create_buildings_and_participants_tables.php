<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('buildings', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('building_id')->constrained()->restrictOnDelete();
            $table->string('full_name');
            $table->string('nim', 32)->unique();
            $table->string('email')->nullable();
            $table->string('room_number', 16);
            $table->string('major');
            $table->string('photo_path')->nullable();
            $table->json('achievements')->nullable();
            $table->string('token_hash');
            $table->timestamp('token_issued_at')->nullable();
            $table->string('status')->default('registered')->index();
            $table->string('current_session_id')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('participants');
        Schema::dropIfExists('buildings');
    }
};
