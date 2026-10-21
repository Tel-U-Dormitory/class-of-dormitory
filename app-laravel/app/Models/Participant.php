<?php

namespace App\Models;

use App\Enums\ParticipantStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class Participant extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\ParticipantFactory> */
    use HasFactory;

    protected $fillable = [
        'building_id',
        'full_name',
        'nim',
        'email',
        'room_number',
        'major',
        'photo_path',
        'achievements',
        'status',
    ];

    protected $hidden = [
        'token_hash',
        'remember_token',
        'current_session_id',
    ];

    protected function casts(): array
    {
        return [
            'achievements' => 'array',
            'status' => ParticipantStatus::class,
            'token_issued_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    /**
     * Token login hanya disimpan sebagai hash; nilai aslinya dikembalikan sekali untuk ditampilkan.
     */
    public function issueToken(): string
    {
        $token = self::generateToken();

        $this->forceFill([
            'token_hash' => Hash::make($token),
            'token_issued_at' => now(),
        ])->save();

        return $token;
    }

    public function checkToken(string $token): bool
    {
        return Hash::check(self::normalizeToken($token), $this->token_hash);
    }

    public static function generateToken(): string
    {
        // Tanpa karakter yang mirip (0/O, 1/I/L) agar mudah diketik ulang.
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $chars = collect(range(1, 8))->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])->implode('');

        return substr($chars, 0, 4).'-'.substr($chars, 4);
    }

    public static function normalizeToken(string $token): string
    {
        $clean = Str::upper(preg_replace('/[^A-Za-z0-9]/', '', $token));

        return strlen($clean) === 8 ? substr($clean, 0, 4).'-'.substr($clean, 4) : $clean;
    }

    public function getAuthPassword(): string
    {
        return $this->token_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'token_hash';
    }
}
