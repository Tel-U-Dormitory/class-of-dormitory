<?php

namespace App\Models;

use App\Enums\ChallengeStatus;
use App\Enums\CompetitionMode;
use App\Enums\GameType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Challenge extends Model
{
    /** @use HasFactory<\Database\Factories\ChallengeFactory> */
    use HasFactory;

    protected $fillable = [
        'code',
        'title',
        'description',
        'chapter',
        'game_type',
        'competition_mode',
        'is_deathmatch',
        'answer_key',
        'max_winners',
        'max_attempts',
        'status',
        'opened_at',
        'ended_at',
        'processed_at',
    ];

    protected $hidden = ['answer_key'];

    protected function casts(): array
    {
        return [
            'game_type' => GameType::class,
            'competition_mode' => CompetitionMode::class,
            'status' => ChallengeStatus::class,
            'is_deathmatch' => 'boolean',
            'opened_at' => 'datetime',
            'ended_at' => 'datetime',
            'processed_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class)->orderBy('name');
    }

    public function invitees(): BelongsToMany
    {
        return $this->belongsToMany(Participant::class, 'challenge_invites')->withTimestamps();
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(ChallengeSubmission::class);
    }

    public function isTeamMode(): bool
    {
        return $this->competition_mode === CompetitionMode::Team;
    }

    public function isActive(): bool
    {
        return $this->status === ChallengeStatus::Active;
    }
}
