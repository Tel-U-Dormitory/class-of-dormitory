<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attempt_sections', function (Blueprint $table) {
            $table->integer('score_web')->nullable()->after('score');
            $table->string('adjustment_type', 20)->nullable()->after('score_web');
            $table->integer('manual_score')->default(0)->after('adjustment_type');
            $table->text('adjustment_notes')->nullable()->after('manual_score');
            $table->foreignId('adjusted_by')->nullable()->after('adjustment_notes')->constrained('users')->nullOnDelete();
            $table->timestamp('adjusted_at')->nullable()->after('adjusted_by');
        });

        DB::table('attempt_sections')->whereNull('score_web')->whereNotNull('score')->update([
            'score_web' => DB::raw('score'),
        ]);
    }

    public function down(): void
    {
        Schema::table('attempt_sections', function (Blueprint $table) {
            $table->dropForeign(['adjusted_by']);
            $table->dropColumn([
                'adjusted_at',
                'adjusted_by',
                'adjustment_notes',
                'manual_score',
                'adjustment_type',
                'score_web',
            ]);
        });
    }
};
