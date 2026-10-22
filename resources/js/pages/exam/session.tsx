import { Countdown } from '@/components/exam/countdown';
import { ObservationOverlay } from '@/components/exam/observation-overlay';
import { QuestionNavigator } from '@/components/exam/question-navigator';
import { QuestionView } from '@/components/exam/question-view';
import { type ExamGroup, type ExamQuestion, type SaveState, type SessionProps } from '@/components/exam/types';
import { useIntegrityMonitor } from '@/components/exam/use-integrity-monitor';
import { FlashToaster } from '@/components/flash-toaster';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServerClock } from '@/hooks/use-server-clock';
import { formatClock } from '@/lib/format';
import { HttpError, postJson } from '@/lib/http';
import { pillarMeta } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Coffee, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function ExamSession(props: SessionProps) {
    const { exam, sections, current, serverNow } = props;
    const now = useServerClock(serverNow);
    const { warning, dismissWarning } = useIntegrityMonitor(props.attempt.status !== 'submitted');

    // Muat ulang props dari server saat tenggat terlewati; server yang memutuskan transisinya.
    const reloading = useRef(false);
    const refresh = useCallback(() => {
        if (reloading.current) return;
        reloading.current = true;
        router.reload({ onFinish: () => window.setTimeout(() => (reloading.current = false), 1500) });
    }, []);

    // Heartbeat: deteksi perubahan dari sisi admin (tambah waktu, dihentikan).
    useEffect(() => {
        const id = window.setInterval(() => {
            postJson<{ status: string; section_id: number | null }>(route('exam.heartbeat'))
                .then((res) => {
                    if (res.status !== props.attempt.status || (current && res.section_id !== current.section_id)) refresh();
                })
                .catch(() => {});
        }, 30000);
        return () => window.clearInterval(id);
    }, [props.attempt.status, current, refresh]);

    return (
        <div className="dark bg-background text-foreground min-h-svh select-none">
            <Head title={current ? `Pilar ${current.label}` : 'Jeda'} />

            {props.break ? (
                <BreakScreen breakInfo={props.break} now={now} sections={sections} onExpire={refresh} />
            ) : current ? (
                <SectionWorkspace key={current.section_id} props={props} now={now} onExpire={refresh} />
            ) : (
                <div className="flex min-h-svh items-center justify-center">
                    <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
                </div>
            )}

            <Dialog open={warning} onOpenChange={(open) => !open && dismissWarning()}>
                <DialogContent className="dark">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CircleAlert className="text-destructive size-5" /> Kamu meninggalkan halaman ujian
                        </DialogTitle>
                        <DialogDescription>
                            Perpindahan tab atau jendela tercatat dan dilaporkan ke panitia. Tetap di halaman ini sampai ujian selesai.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={dismissWarning}>Saya mengerti</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FlashToaster />
            <span className="sr-only">{exam.title}</span>
        </div>
    );
}

function PillarSteps({ sections }: { sections: SessionProps['sections'] }) {
    return (
        <ol className="flex items-center gap-1.5" aria-label="Urutan pilar">
            {sections.map((s) => {
                const meta = pillarMeta[s.pillar];
                return (
                    <li key={s.id} className="flex items-center gap-1.5" title={`${s.label}: ${s.state}`}>
                        <span
                            className={cn(
                                'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
                                s.state === 'current' && 'border-foreground/40 bg-accent',
                                s.state === 'done' && 'text-muted-foreground',
                                (s.state === 'upcoming' || s.state === 'next') && 'text-muted-foreground/70 border-dashed',
                            )}
                        >
                            {s.state === 'done' ? <CircleCheck className="size-3.5 text-emerald-400" /> : <meta.icon className={cn('size-3.5', meta.text)} />}
                            <span className="hidden md:inline">{s.label}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function BreakScreen({
    breakInfo,
    now,
    sections,
    onExpire,
}: {
    breakInfo: NonNullable<SessionProps['break']>;
    now: number;
    sections: SessionProps['sections'];
    onExpire: () => void;
}) {
    const remaining = breakInfo.ends_at - now;
    const [skipping, setSkipping] = useState(false);
    const next = breakInfo.next_section;
    const meta = next ? pillarMeta[next.pillar] : null;

    useEffect(() => {
        if (remaining <= 0) onExpire();
    }, [remaining <= 0, onExpire]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex min-h-svh flex-col">
            <header className="flex items-center justify-center border-b px-4 py-3">
                <PillarSteps sections={sections} />
            </header>
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                <Coffee className="text-gold size-10" />
                <h1 className="font-display mt-6 text-3xl font-bold">Jeda</h1>
                <p className="text-muted-foreground mt-2">Pilar sebelumnya sudah terkunci. Tarik napas sejenak.</p>
                <p className="mt-8 font-mono text-6xl font-semibold tabular-nums">{formatClock(remaining / 1000)}</p>
                {next && meta && (
                    <p className="mt-6 flex items-center gap-2 text-sm">
                        Berikutnya: <meta.icon className={cn('size-4', meta.text)} /> <strong>{next.label}</strong> · {Math.round(next.duration_seconds / 60)} menit
                    </p>
                )}
                <Button
                    size="lg"
                    className="mt-10"
                    disabled={skipping}
                    onClick={() => {
                        setSkipping(true);
                        router.post(route('exam.break.skip'), {}, { onFinish: () => setSkipping(false) });
                    }}
                >
                    {skipping && <LoaderCircle className="animate-spin" />}
                    Mulai pilar berikutnya sekarang
                </Button>
                <p className="text-muted-foreground mt-3 text-xs">Jika tidak dilewati, pilar berikutnya dimulai otomatis saat jeda habis.</p>
            </div>
        </div>
    );
}

type FlatQuestion = { question: ExamQuestion; group: ExamGroup };

function SectionWorkspace({ props, now, onExpire }: { props: SessionProps; now: number; onExpire: () => void }) {
    const current = props.current!;
    const isLastSection = props.sections[props.sections.length - 1]?.id === current.section_id;
    const meta = pillarMeta[current.pillar];

    const flat = useMemo<FlatQuestion[]>(() => current.groups.flatMap((group) => group.questions.map((question) => ({ question, group }))), [current.groups]);

    const storageKey = `cod:section:${current.section_id}:question`;
    const [currentId, setCurrentId] = useState<number | null>(() => {
        const stored = Number(sessionStorage.getItem(storageKey));
        return flat.some((f) => f.question.id === stored) ? stored : (flat[0]?.question.id ?? null);
    });
    useEffect(() => {
        if (currentId) sessionStorage.setItem(storageKey, String(currentId));
    }, [currentId, storageKey]);

    const index = Math.max(0, flat.findIndex((f) => f.question.id === currentId));
    const active = flat[index];

    // Jawaban dikelola lokal (optimistis) lalu dikirim ke server.
    const [answers, setAnswers] = useState<Record<string, number | null>>(current.answers);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const pending = useRef(0);

    const answeredCount = Object.values(answers).filter((v) => v != null).length;

    const saveAnswer = useCallback(
        (questionId: number, optionId: number | null) => {
            setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
            setSaveState('saving');
            pending.current++;
            postJson(route('exam.answer', questionId), { option_id: optionId })
                .then(() => {
                    pending.current--;
                    if (pending.current === 0) setSaveState('saved');
                })
                .catch((error: unknown) => {
                    pending.current--;
                    setSaveState('error');
                    if (error instanceof HttpError && error.status === 422) onExpire();
                });
        },
        [onExpire],
    );

    const remaining = current.deadline_at - now;
    useEffect(() => {
        if (remaining <= 0) onExpire();
    }, [remaining <= 0, onExpire]); // eslint-disable-line react-hooks/exhaustive-deps

    // Observasi aktif: tampil layar penuh, tutup otomatis saat waktunya habis.
    const observing = current.groups.find((g) => g.observation.state === 'active') ?? null;
    const observationEnded = observing?.observation.ends_at != null && observing.observation.ends_at <= now;
    useEffect(() => {
        if (observationEnded) onExpire();
    }, [observationEnded, onExpire]);

    const [busy, setBusy] = useState(false);
    const post = (url: string, after?: () => void) => {
        setBusy(true);
        router.post(url, {}, { preserveScroll: true, onFinish: () => setBusy(false), onSuccess: after });
    };

    const go = useCallback((delta: number) => setCurrentId((id) => flat[Math.min(flat.length - 1, Math.max(0, flat.findIndex((f) => f.question.id === id) + delta))]?.question.id ?? id), [flat]);

    // Navigasi papan ketik: ←/→ pindah soal, A–D atau 1–4 memilih jawaban.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (observing || e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
            else if (active && !active.question.locked) {
                const key = e.key.toUpperCase();
                const idx = /^[1-6]$/.test(key) ? Number(key) - 1 : 'ABCDEF'.indexOf(key);
                const option = idx >= 0 ? active.question.options[idx] : undefined;
                if (option) saveAnswer(active.question.id, option.id);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, go, observing, saveAnswer]);

    const [confirmFinish, setConfirmFinish] = useState(false);

    return (
        <div className="flex min-h-svh flex-col">
            <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('rounded-md p-1.5', meta.text, 'bg-current/10')}>
                            <meta.icon className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">Pilar {current.label}</p>
                            <SaveIndicator state={saveState} answered={answeredCount} total={current.question_count} />
                        </div>
                    </div>
                    <div className="hidden lg:block">
                        <PillarSteps sections={props.sections} />
                    </div>
                    <Countdown remainingMs={remaining} />
                </div>
                <div className="bg-muted h-0.5">
                    <div className={cn('h-full transition-all', meta.bg)} style={{ width: `${(answeredCount / Math.max(1, current.question_count)) * 100}%` }} />
                </div>
            </header>

            <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_18rem]">
                <main className="min-w-0 space-y-4">
                    {current.instructions && index === 0 && <div className="bg-muted/40 rounded-lg border p-4 text-sm leading-relaxed">{current.instructions}</div>}

                    {active ? (
                        <QuestionView
                            question={active.question}
                            group={active.group}
                            total={current.question_count}
                            selected={answers[active.question.id]}
                            onSelect={(optionId) => saveAnswer(active.question.id, optionId)}
                            onClear={() => saveAnswer(active.question.id, null)}
                            onStartObservation={() => post(route('exam.observation.start', active.group.id))}
                            startingObservation={busy}
                            observationBusy={observing !== null}
                        />
                    ) : (
                        <div className="text-muted-foreground bg-card rounded-xl border p-10 text-center">Pilar ini belum memiliki soal.</div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                        <Button variant="outline" onClick={() => go(-1)} disabled={index === 0}>
                            <ChevronLeft /> Sebelumnya
                        </Button>
                        {index < flat.length - 1 ? (
                            <Button variant="outline" onClick={() => go(1)}>
                                Berikutnya <ChevronRight />
                            </Button>
                        ) : (
                            <Button onClick={() => setConfirmFinish(true)}>{isLastSection ? 'Kirim ujian' : 'Selesaikan pilar'}</Button>
                        )}
                    </div>
                </main>

                <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                    <div className="bg-card rounded-xl border p-4">
                        <div className="mb-3 flex items-center justify-between text-sm">
                            <span className="font-medium">Navigasi soal</span>
                            <span className="text-muted-foreground tabular-nums">
                                {answeredCount}/{current.question_count}
                            </span>
                        </div>
                        <QuestionNavigator groups={current.groups} answers={answers} currentId={active?.question.id ?? null} onJump={setCurrentId} />
                        <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="bg-primary size-3 rounded-sm" /> Terjawab
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="bg-background size-3 rounded-sm border" /> Belum
                            </span>
                        </div>
                    </div>
                    <Button variant="secondary" className="w-full" onClick={() => setConfirmFinish(true)}>
                        {isLastSection ? 'Kirim ujian' : `Selesaikan pilar ${current.label}`}
                    </Button>
                </aside>
            </div>

            {observing && (
                <ObservationOverlay group={observing} now={now} finishing={busy} onFinish={() => post(route('exam.observation.finish', observing.id))} />
            )}

            <Dialog open={confirmFinish} onOpenChange={setConfirmFinish}>
                <DialogContent className="dark">
                    <DialogHeader>
                        <DialogTitle>{isLastSection ? 'Kirim ujian sekarang?' : `Selesaikan pilar ${current.label}?`}</DialogTitle>
                        <DialogDescription>
                            Terjawab {answeredCount} dari {current.question_count} soal.{' '}
                            {isLastSection
                                ? 'Setelah dikirim, ujian selesai dan jawaban tidak bisa diubah.'
                                : 'Pilar ini akan terkunci dan kamu tidak bisa kembali. Sisa waktunya tidak dipindahkan ke pilar berikutnya.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmFinish(false)}>
                            Kembali
                        </Button>
                        <Button disabled={busy || saveState === 'saving'} onClick={() => post(route('exam.section.finish'), () => setConfirmFinish(false))}>
                            {busy && <LoaderCircle className="animate-spin" />}
                            {isLastSection ? 'Ya, kirim' : 'Ya, selesaikan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SaveIndicator({ state, answered, total }: { state: SaveState; answered: number; total: number }) {
    const text = {
        idle: `${answered}/${total} terjawab`,
        saving: 'Menyimpan…',
        saved: `Tersimpan · ${answered}/${total} terjawab`,
        error: 'Gagal menyimpan, periksa koneksi',
    }[state];

    return <p className={cn('text-xs', state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{text}</p>;
}
