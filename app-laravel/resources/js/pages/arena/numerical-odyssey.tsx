import { ArenaStatusNotice } from '@/components/arena/arena-status';
import { EntrantPicker } from '@/components/arena/entrant-picker';
import { ResultOverlay } from '@/components/arena/result-overlay';
import { type ArenaChallenge, type Entrant, type SubmitResult } from '@/components/arena/types';
import ArenaLayout from '@/layouts/arena-layout';
import { HttpError, postJson } from '@/lib/http';
import { playCorrect, playKey, playWrong } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { Head, usePoll } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Props {
    challenge: ArenaChallenge;
    entrants: Entrant[];
}

const DIGITS = ['1', '2', '3', '4', '5', '6'];
const OPERATORS = ['(', ')', '×', '÷', '+', '-', '√(', '^', '!'];
const KEYBOARD: Record<string, string> = { '*': '×', x: '×', '/': '÷', '+': '+', '-': '-', '(': '(', ')': ')', '^': '^', '!': '!', r: '√(', v: '√(' };

export default function NumericalOdyssey({ challenge, entrants }: Props) {
    // Kiosk terbuka otomatis saat panitia membuka game.
    usePoll(challenge.status === 'active' ? 30000 : 4000, { only: ['challenge', 'entrants'] });

    const [entrantId, setEntrantId] = useState<number | null>(null);
    const [tokens, setTokens] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [overlay, setOverlay] = useState<{ result: 'correct' | 'wrong'; detail: string | null } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const push = useCallback((token: string) => {
        playKey();
        setNotice(null);
        setTokens((t) => (t.length >= 60 ? t : [...t, token]));
    }, []);
    const backspace = useCallback(() => {
        playKey();
        setTokens((t) => t.slice(0, -1));
    }, []);
    const clear = useCallback(() => {
        playKey();
        setTokens([]);
    }, []);

    const submit = useCallback(async () => {
        if (!entrantId) return setNotice(challenge.competition_mode === 'team' ? 'Pilih kelompok terlebih dahulu.' : 'Pilih nama peserta terlebih dahulu.');
        if (!tokens.length) return setNotice('Rumus masih kosong.');

        setSubmitting(true);
        try {
            const res = await postJson<SubmitResult>(route('arena.submit', challenge.code), { entrant_id: entrantId, tokens });
            res.correct ? playCorrect() : playWrong();
            setOverlay({ result: res.correct ? 'correct' : 'wrong', detail: res.message });
        } catch (error) {
            playWrong();
            setNotice(error instanceof HttpError ? error.message : 'Gagal mengirim. Periksa koneksi.');
        } finally {
            setSubmitting(false);
        }
    }, [challenge.code, challenge.competition_mode, entrantId, tokens]);

    const closeOverlay = useCallback(() => {
        const wasCorrect = overlay?.result === 'correct';
        setOverlay(null);
        setTokens([]);
        // Setelah benar, kiosk siap untuk peserta berikutnya.
        if (wasCorrect) setEntrantId(null);
    }, [overlay]);

    useEffect(() => {
        if (overlay || challenge.status !== 'active') return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'SELECT') return;
            if (DIGITS.includes(e.key)) push(e.key);
            else if (KEYBOARD[e.key.toLowerCase()]) push(KEYBOARD[e.key.toLowerCase()]);
            else if (e.key === 'Backspace') backspace();
            else if (e.key === 'Escape' || e.key === 'Delete') clear();
            else if (e.key === 'Enter') void submit();
            else return;
            e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [overlay, challenge.status, push, backspace, clear, submit]);

    const formula = tokens.join('');

    return (
        <ArenaLayout>
            <Head title={challenge.title} />

            <main className="mx-auto flex max-w-5xl flex-col gap-5">
                {challenge.status !== 'active' ? (
                    <div className="mx-auto w-full max-w-xl">
                        <h1 className="font-display mb-4 text-center text-xl font-bold tracking-wide text-amber-300 uppercase">{challenge.title}</h1>
                        <ArenaStatusNotice status={challenge.status} />
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-[3fr_1fr]">
                            <section className="flex flex-col rounded-md border border-yellow-500/30 bg-[#0A0E18] p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="font-display text-sm font-bold tracking-wider text-amber-300 uppercase">{challenge.title}</span>
                                    {challenge.is_deathmatch && <span className="rounded bg-red-600/25 px-2 py-0.5 text-xs font-semibold text-red-300">Deathmatch</span>}
                                </div>
                                <div
                                    aria-live="polite"
                                    className="flex min-h-[4.5rem] items-center overflow-x-auto rounded border-2 border-yellow-400/30 bg-[#020617] px-5 py-4 font-mono text-3xl font-bold tracking-[0.15em] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                                >
                                    <span className={formula ? 'text-yellow-400' : 'text-slate-500'}>{formula || '0'}</span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    Gunakan angka 1–6 (masing-masing maks. 2×, tidak boleh digabung) dan operator untuk mencapai target.
                                </p>
                                {notice && <p className="mt-2 text-sm font-medium text-red-300">{notice}</p>}
                            </section>

                            <section className="rounded-md border border-yellow-500/30 bg-[#0A0E18] p-3.5">
                                <h2 className="mb-2.5 text-xs font-bold tracking-wider text-amber-300 uppercase">Tim gedung & peserta</h2>
                                <EntrantPicker
                                    entrants={entrants}
                                    value={entrantId}
                                    onChange={setEntrantId}
                                    teamMode={challenge.competition_mode === 'team'}
                                    className="[&>label]:sr-only"
                                />
                            </section>
                        </div>

                        <section className="rounded-md border border-yellow-500/30 bg-[#0A0E18] p-5">
                            <div className="grid grid-cols-6 gap-2.5">
                                {DIGITS.map((d) => (
                                    <Key key={d} variant="digit" onClick={() => push(d)}>
                                        {d}
                                    </Key>
                                ))}
                                {OPERATORS.map((op) => (
                                    <Key key={op} variant="operator" onClick={() => push(op)} label={op === '√(' ? 'Akar' : undefined}>
                                        {op === '√(' ? '√' : op}
                                    </Key>
                                ))}
                                <Key variant="danger" onClick={clear} label="Hapus semua">
                                    C
                                </Key>
                                <Key variant="danger" className="col-span-2" onClick={backspace}>
                                    HAPUS
                                </Key>
                                <button
                                    type="button"
                                    onClick={() => void submit()}
                                    disabled={submitting}
                                    className="col-span-6 flex items-center justify-center gap-2 rounded border-2 border-green-500 bg-gradient-to-br from-green-600 to-green-700 p-5 text-base font-bold tracking-[0.15em] text-white uppercase transition hover:-translate-y-0.5 hover:from-green-500 hover:to-green-600 active:translate-y-px disabled:opacity-60"
                                >
                                    {submitting && <LoaderCircle className="size-5 animate-spin" />}
                                    Submit formula hasil
                                </button>
                            </div>
                            <p className="mt-3 text-center text-xs text-slate-600">Papan ketik: 1–6, * / + - ( ) ^ !, R = akar, Backspace, Esc, Enter</p>
                        </section>
                    </>
                )}
            </main>

            {overlay && <ResultOverlay result={overlay.result} detail={overlay.detail} onClose={closeOverlay} />}
        </ArenaLayout>
    );
}

function Key({
    variant,
    children,
    onClick,
    className,
    label,
}: {
    variant: 'digit' | 'operator' | 'danger';
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
    label?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
                'rounded px-2 py-4 font-bold shadow-[0_4px_8px_rgba(0,0,0,0.5)] transition-all duration-100 hover:-translate-y-0.5 active:translate-y-px sm:py-[1.125rem]',
                variant === 'digit' && 'border border-blue-500/40 bg-gradient-to-b from-[#1E3A5F] to-[#0F1F36] text-2xl hover:from-blue-600 hover:to-blue-700',
                variant === 'operator' && 'border border-yellow-500/40 bg-gradient-to-b from-[#3D2000] to-[#1F1000] text-lg text-amber-300 hover:from-amber-800 hover:to-amber-900',
                variant === 'danger' && 'border border-red-500/40 bg-gradient-to-b from-red-900 to-[#450A0A] text-lg text-red-300 hover:from-red-600 hover:to-red-700',
                className,
            )}
        >
            {children}
        </button>
    );
}
