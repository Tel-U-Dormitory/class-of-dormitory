<?php

namespace Tests\Unit;

use App\Services\Challenge\FormulaEvaluator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class FormulaEvaluatorTest extends TestCase
{
    public static function validFormulas(): array
    {
        return [
            'perkalian sederhana' => [['6', '×', '4'], 24.0],
            'kurung dan pembagian' => [['(', '5', '+', '1', ')', '×', '(', '6', '÷', '2', '+', '1', ')'], 24.0],
            'prioritas operator' => [['2', '+', '3', '×', '4'], 14.0],
            'pangkat asosiatif kanan' => [['2', '^', '3', '^', '2'], 512.0],
            'faktorial' => [['4', '!'], 24.0],
            'faktorial ekspresi' => [['(', '1', '+', '3', ')', '!'], 24.0],
            'akar' => [['√(', '4', ')', '×', '6', '×', '2'], 24.0],
            'unary minus' => [['-', '2', '+', '6'], 4.0],
        ];
    }

    #[DataProvider('validFormulas')]
    public function test_evaluates_valid_formulas(array $tokens, float $expected): void
    {
        $this->assertEqualsWithDelta($expected, (new FormulaEvaluator)->evaluate($tokens), 0.0001);
    }

    public static function invalidFormulas(): array
    {
        return [
            'kosong' => [[]],
            'dua digit' => [['2', '4']],
            'angka lebih dari dua kali' => [['1', '+', '1', '+', '1']],
            'angka di luar 1-6' => [['8', '×', '3']],
            'simbol asing' => [['6', '*', '4']],
            'kurung tidak seimbang' => [['(', '6', '×', '4']],
            'operator menggantung' => [['6', '×']],
            'bagi nol' => [['6', '÷', '(', '2', '-', '2', ')']],
            'akar negatif' => [['√(', '-', '4', ')']],
            'faktorial pecahan' => [['(', '1', '÷', '2', ')', '!']],
            'perkalian implisit' => [['2', '(', '3', ')']],
        ];
    }

    #[DataProvider('invalidFormulas')]
    public function test_rejects_invalid_formulas(array $tokens): void
    {
        $this->assertNull((new FormulaEvaluator)->evaluate($tokens));
    }

    public function test_matches_target(): void
    {
        $evaluator = new FormulaEvaluator;

        $this->assertTrue($evaluator->matches(['6', '×', '4'], 24));
        $this->assertFalse($evaluator->matches(['6', '×', '3'], 24));
    }
}
