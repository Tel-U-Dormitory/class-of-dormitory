export interface BankOption {
    id: number;
    label: string;
    content: string | null;
    image_url: string | null;
    is_correct: boolean;
}

export interface BankQuestion {
    id: number;
    position: number;
    body: string;
    is_latex: boolean;
    image_url: string | null;
    options_are_images: boolean;
    points: number;
    penalty: number;
    is_active: boolean;
    notes: string | null;
    options: BankOption[];
}

export interface BankGroup {
    id: number;
    title: string;
    kind: string | null;
    position: number;
    stimulus_type: 'none' | 'text' | 'image' | 'video' | 'flash';
    stimulus_text: string | null;
    stimulus_duration_seconds: number | null;
    stimulus_media_url: string | null;
    stimulus_slides: { path: string; url: string; duration: number }[];
    questions: BankQuestion[];
}
