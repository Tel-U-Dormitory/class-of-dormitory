import { cn } from '@/lib/utils';

const tones: Record<string, string> = {
    // peserta
    registered: 'bg-secondary text-secondary-foreground',
    in_exam: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    submitted: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    cast_selected: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    eliminated: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    advanced: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    deathmatch: 'bg-red-500/15 text-red-700 dark:text-red-300',
    disqualified: 'bg-destructive/15 text-destructive',
    // attempt
    in_progress: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    on_break: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    // ujian
    draft: 'bg-secondary text-secondary-foreground',
    open: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    closed: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
};

export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
    return (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[status] ?? tones.registered, className)}>
            {label}
        </span>
    );
}
