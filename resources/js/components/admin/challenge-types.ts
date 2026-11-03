export interface ChallengeSummary {
    id: number;
    code: string;
    title: string;
    chapter: number;
    game_type: string;
    game_type_label: string;
    competition_mode: 'individual' | 'team';
    is_deathmatch: boolean;
    max_winners: number;
    max_attempts: number | null;
    status: 'locked' | 'active' | 'ended';
    status_label: string;
    arena_url: string;
}

export interface GameTypeOption {
    value: string;
    label: string;
    hint: string;
    default_max_attempts: number | null;
}
