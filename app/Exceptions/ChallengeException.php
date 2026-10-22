<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ChallengeException extends RuntimeException
{
    public static function notActive(): self
    {
        return new self('Game sedang tidak dibuka.');
    }

    public static function notInRoster(): self
    {
        return new self('Peserta atau tim ini tidak terdaftar di game ini.');
    }

    public static function alreadyCorrect(): self
    {
        return new self('Sudah menjawab benar. Jawaban tercatat.');
    }

    public static function noAttemptsLeft(): self
    {
        return new self('Kesempatan menjawab sudah habis.');
    }

    public function render(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $this->getMessage()], 422);
        }

        return back()->with('error', $this->getMessage());
    }
}
