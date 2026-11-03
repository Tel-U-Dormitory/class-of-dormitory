import { type Pillar } from '@/types';

export interface ExamOption {
    id: number;
    label: string;
    content: string;
}

export type ExamQuestion =
    | { id: number; number: number; locked: true }
    | {
          id: number;
          number: number;
          locked: false;
          body: string;
          is_latex: boolean;
          image_url: string | null;
          options_are_images: boolean;
          options: ExamOption[];
      };

export interface Stimulus {
    text: string | null;
    media_url: string | null;
    slides: { url: string; duration: number }[] | null;
}

export interface ExamGroup {
    id: number;
    title: string;
    stimulus_type: 'none' | 'text' | 'image' | 'video' | 'flash';
    observation: { state: 'none' | 'pending' | 'active' | 'done'; duration_seconds: number; ends_at: number | null };
    stimulus: Stimulus | null;
    questions: ExamQuestion[];
}

export interface SectionSummary {
    id: number;
    pillar: Pillar;
    label: string;
    duration_seconds: number;
    state: 'done' | 'current' | 'next' | 'upcoming';
}

export interface CurrentSection {
    section_id: number;
    pillar: Pillar;
    label: string;
    instructions: string | null;
    deadline_at: number;
    groups: ExamGroup[];
    answers: Record<string, number | null>;
    question_count: number;
}

export interface SessionProps {
    attempt: { id: number; status: 'in_progress' | 'on_break' | 'submitted' };
    exam: { title: string };
    serverNow: number;
    sections: SectionSummary[];
    current: CurrentSection | null;
    break: { ends_at: number; next_section: SectionSummary | null } | null;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
