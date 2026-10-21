<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Pelanggaran aturan ujian yang pesannya aman ditampilkan ke peserta.
 */
class ExamException extends RuntimeException
{
    public static function examClosed(): self
    {
        return new self('Ujian belum dibuka atau sudah ditutup.');
    }

    public static function alreadySubmitted(): self
    {
        return new self('Kamu sudah menyelesaikan ujian ini.');
    }

    public static function participantBlocked(): self
    {
        return new self('Akun kamu tidak diizinkan mengikuti ujian. Hubungi panitia.');
    }

    public static function noSections(): self
    {
        return new self('Ujian belum memiliki pilar soal.');
    }

    public static function notInProgress(): self
    {
        return new self('Pilar sedang tidak berlangsung.');
    }

    public static function sectionLocked(): self
    {
        return new self('Soal ini berada di pilar yang tidak sedang berlangsung.');
    }

    public static function observationRequired(): self
    {
        return new self('Selesaikan fase observasi terlebih dahulu.');
    }

    public static function observationAlreadyUsed(): self
    {
        return new self('Materi observasi hanya bisa ditampilkan satu kali.');
    }

    public static function observationInProgress(): self
    {
        return new self('Masih ada fase observasi yang berlangsung.');
    }

    public static function invalidOption(): self
    {
        return new self('Pilihan jawaban tidak valid.');
    }

    public static function notOnBreak(): self
    {
        return new self('Tidak sedang dalam jeda.');
    }

    public function render(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $this->getMessage()], 422);
        }

        return back()->with('error', $this->getMessage());
    }
}
