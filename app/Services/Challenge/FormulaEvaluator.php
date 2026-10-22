<?php

namespace App\Services\Challenge;

/**
 * Evaluator rumus Numerical Odyssey tanpa eval().
 *
 * Aturan (sama dengan versi lama):
 * - Hanya token angka 1–6 dan operator ( ) × ÷ + - √( ^ !
 * - Dua angka tidak boleh bersebelahan (tidak boleh membentuk bilangan dua digit).
 * - Setiap angka paling banyak dipakai dua kali.
 * - Hasil harus sama dengan target.
 *
 * Tata bahasa: expr → term (± term)*, term → unary (×÷ unary)*,
 * unary → ± unary | power, power → postfix (^ unary)?, postfix → primary !?,
 * primary → angka | ( expr ) | √( expr ).
 */
class FormulaEvaluator
{
    public const DIGITS = ['1', '2', '3', '4', '5', '6'];

    public const OPERATORS = ['(', ')', '×', '÷', '+', '-', '√(', '^', '!'];

    private const MAX_FACTORIAL = 20;

    /** @var list<string> */
    private array $tokens = [];

    private int $pos = 0;

    /**
     * @param  list<string>  $tokens
     */
    public function validate(array $tokens): ?string
    {
        if ($tokens === []) {
            return 'Rumus masih kosong.';
        }

        if (count($tokens) > 60) {
            return 'Rumus terlalu panjang.';
        }

        $counts = [];

        foreach ($tokens as $i => $token) {
            if (! in_array($token, [...self::DIGITS, ...self::OPERATORS], true)) {
                return 'Rumus mengandung simbol yang tidak diizinkan.';
            }

            if (in_array($token, self::DIGITS, true)) {
                if (in_array($tokens[$i + 1] ?? null, self::DIGITS, true)) {
                    return 'Angka tidak boleh digabung menjadi bilangan dua digit.';
                }

                $counts[$token] = ($counts[$token] ?? 0) + 1;

                if ($counts[$token] > 2) {
                    return "Angka {$token} dipakai lebih dari dua kali.";
                }
            }
        }

        return null;
    }

    /**
     * @param  list<string>  $tokens
     */
    public function evaluate(array $tokens): ?float
    {
        if ($this->validate($tokens) !== null) {
            return null;
        }

        $this->tokens = $tokens;
        $this->pos = 0;

        try {
            $value = $this->expression();

            if ($this->pos !== count($this->tokens) || ! is_finite($value)) {
                return null;
            }

            return $value;
        } catch (\ArithmeticError|\InvalidArgumentException) {
            return null;
        }
    }

    /**
     * @param  list<string>  $tokens
     */
    public function matches(array $tokens, float $target): bool
    {
        $value = $this->evaluate($tokens);

        return $value !== null && abs($value - $target) < 0.0001;
    }

    private function expression(): float
    {
        $value = $this->term();

        while (in_array($this->peek(), ['+', '-'], true)) {
            $value = $this->next() === '+' ? $value + $this->term() : $value - $this->term();
        }

        return $value;
    }

    private function term(): float
    {
        $value = $this->unary();

        while (in_array($this->peek(), ['×', '÷'], true)) {
            if ($this->next() === '×') {
                $value *= $this->unary();
            } else {
                $divisor = $this->unary();

                if ($divisor == 0.0) {
                    throw new \InvalidArgumentException('Pembagian dengan nol.');
                }

                $value /= $divisor;
            }
        }

        return $value;
    }

    private function unary(): float
    {
        if (in_array($this->peek(), ['+', '-'], true)) {
            return $this->next() === '-' ? -$this->unary() : $this->unary();
        }

        return $this->power();
    }

    private function power(): float
    {
        $base = $this->postfix();

        if ($this->peek() === '^') {
            $this->next();
            $result = $base ** $this->unary();

            if (! is_finite($result) || is_nan($result)) {
                throw new \InvalidArgumentException('Pangkat tidak valid.');
            }

            return $result;
        }

        return $base;
    }

    private function postfix(): float
    {
        $value = $this->primary();

        if ($this->peek() === '!') {
            $this->next();

            if ($value < 0 || $value > self::MAX_FACTORIAL || floor($value) !== $value) {
                throw new \InvalidArgumentException('Faktorial hanya untuk bilangan bulat 0–20.');
            }

            $result = 1.0;

            for ($i = 2; $i <= $value; $i++) {
                $result *= $i;
            }

            return $result;
        }

        return $value;
    }

    private function primary(): float
    {
        $token = $this->next();

        if ($token !== null && in_array($token, self::DIGITS, true)) {
            return (float) $token;
        }

        if ($token === '(' || $token === '√(') {
            $value = $this->expression();

            if ($this->next() !== ')') {
                throw new \InvalidArgumentException('Kurung tidak seimbang.');
            }

            if ($token === '√(') {
                if ($value < 0) {
                    throw new \InvalidArgumentException('Akar dari bilangan negatif.');
                }

                return sqrt($value);
            }

            return $value;
        }

        throw new \InvalidArgumentException('Rumus tidak lengkap.');
    }

    private function peek(): ?string
    {
        return $this->tokens[$this->pos] ?? null;
    }

    private function next(): ?string
    {
        return $this->tokens[$this->pos++] ?? null;
    }
}
