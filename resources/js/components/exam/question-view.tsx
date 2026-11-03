import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Eye, Lock } from 'lucide-react';
import { MathText } from './math-text';
import { type ExamGroup, type ExamQuestion } from './types';

export function QuestionView({
    question,
    group,
    total,
    selected,
    onSelect,
    onClear,
    onStartObservation,
    startingObservation,
    observationBusy,
}: {
    question: ExamQuestion;
    group: ExamGroup;
    total: number;
    selected: number | null | undefined;
    onSelect: (optionId: number) => void;
    onClear: () => void;
    onStartObservation: () => void;
    startingObservation: boolean;
    observationBusy: boolean;
}) {
    if (question.locked) {
        return (
            <div className="bg-card flex flex-col items-center rounded-xl border px-6 py-14 text-center">
                <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
                    {group.observation.state === 'pending' ? <Eye className="size-6" /> : <Lock className="size-6" />}
                </div>
                <h2 className="mt-5 text-lg font-semibold">{group.title}</h2>
                <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
                    Soal {question.number} berada di grup dengan materi observasi. Materi akan tampil selama {group.observation.duration_seconds} detik dan hanya
                    sekali. Setelah itu soal-soal grup ini terbuka.
                </p>
                <Button className="mt-6" size="lg" onClick={onStartObservation} disabled={startingObservation || observationBusy}>
                    Tampilkan materi observasi
                </Button>
                {observationBusy && <p className="text-muted-foreground mt-3 text-xs">Selesaikan observasi yang sedang berjalan terlebih dahulu.</p>}
            </div>
        );
    }

    return (
        <article className="bg-card rounded-xl border p-5 sm:p-8" aria-labelledby={`q-${question.id}`}>
            <div className="text-muted-foreground mb-4 flex items-center justify-between text-sm">
                <span id={`q-${question.id}`} className="text-foreground font-medium">
                    Soal {question.number} <span className="text-muted-foreground font-normal">dari {total}</span>
                </span>
                <span className="truncate pl-4">{group.title}</span>
            </div>

            <MathText text={question.body} latex={question.is_latex} className="exam-prose" />

            {question.image_url && (
                <img src={question.image_url} alt={`Gambar soal ${question.number}`} className="mt-5 max-h-[22rem] rounded-lg border object-contain" draggable={false} />
            )}

            <div role="radiogroup" aria-label="Pilihan jawaban" className={cn('mt-6 grid gap-3', question.options_are_images ? 'grid-cols-2' : 'grid-cols-1')}>
                {question.options.map((option, i) => {
                    const isSelected = selected === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => onSelect(option.id)}
                            className={cn(
                                'focus-visible:ring-ring/50 flex items-center gap-3 rounded-lg border p-3 text-left transition outline-none focus-visible:ring-[3px] sm:p-4',
                                isSelected ? 'border-primary bg-primary/10 ring-primary/30 ring-1' : 'hover:border-foreground/30 hover:bg-accent/50',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-md border text-sm font-semibold',
                                    isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted',
                                )}
                            >
                                {option.label}
                            </span>
                            {question.options_are_images ? (
                                <img src={option.content} alt={`Pilihan ${option.label}`} className="max-h-40 w-full object-contain" draggable={false} />
                            ) : (
                                <span className="text-[0.975rem] leading-relaxed">{option.content}</span>
                            )}
                            <span className="sr-only">Tekan {i + 1}</span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    type="button"
                    onClick={onClear}
                    disabled={selected == null}
                    className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                    Kosongkan jawaban
                </button>
            </div>
        </article>
    );
}
