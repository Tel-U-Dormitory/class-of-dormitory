<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Documentation extends Model
{
    /** Jumlah foto yang tampil di beranda; sisanya tersimpan tetapi tidak ditampilkan. */
    public const LANDING_LIMIT = 4;

    protected $table = 'documentations';

    protected $fillable = ['caption', 'image_path', 'sort_order'];

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }

    /** Parameter v memaksa browser memuat ulang gambar setelah diganti. */
    public function imageUrl(): string
    {
        return route('documentation.image', $this).'?v='.$this->updated_at?->timestamp;
    }
}