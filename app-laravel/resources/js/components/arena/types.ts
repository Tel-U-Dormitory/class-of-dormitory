export interface ArenaChallenge {
    code: string;
    title: string;
    description: string | null;
    chapter: number;
    game_type: 'numerical_odyssey' | 'numeric_keypad' | 'text_code' | 'choice';
    competition_mode: 'individual' | 'team';
    is_deathmatch: boolean;
    status: 'locked' | 'active' | 'ended';
    max_attempts: number | null;
}

export interface Entrant {
    id: number;
    label: string;
    detail: string;
}

export interface SubmitResult {
    correct: boolean;
    message: string;
    attempts_left: number | null;
}
