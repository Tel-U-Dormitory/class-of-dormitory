import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';
import { type ExamGroup } from './types';

export function QuestionNavigator({
    groups,
    answers,
    currentId,
    onJump,
}: {
    groups: ExamGroup[];
    answers: Record<string, number | null>;
    currentId: number | null;
    onJump: (questionId: number) => void;
}) {
    return (
        <div className="space-y-4">
            {groups.map((group) => (
                <div key={group.id}>
                    <p className="text-muted-foreground mb-2 truncate text-xs font-medium">{group.title}</p>
                    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5 xl:grid-cols-6">
                        {group.questions.map((q) => {
                            const answered = answers[q.id] != null;
                            const current = q.id === currentId;
                            return (
                                <button
                                    key={q.id}
                                    type="button"
                                    onClick={() => onJump(q.id)}
                                    aria-label={`Soal ${q.number}${answered ? ', terjawab' : ''}${q.locked ? ', terkunci' : ''}`}
                                    aria-current={current ? 'step' : undefined}
                                    className={cn(
                                        'relative flex aspect-square items-center justify-center rounded-md border text-xs font-medium tabular-nums transition',
                                        answered ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent',
                                        current && 'ring-foreground ring-offset-background ring-2 ring-offset-1',
                                        q.locked && 'text-muted-foreground',
                                    )}
                                >
                                    {q.locked ? <Lock className="size-3" /> : q.number}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
