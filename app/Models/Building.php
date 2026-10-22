<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Building extends Model
{
    protected $fillable = ['name', 'sort_order'];

    public function participants(): HasMany
    {
        return $this->hasMany(Participant::class);
    }
}
