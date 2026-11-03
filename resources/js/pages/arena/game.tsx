import { ArenaStatusNotice } from '@/components/arena/arena-status';
import { EntrantPicker } from '@/components/arena/entrant-picker';
import { ResultOverlay } from '@/components/arena/result-overlay';
import { type ArenaChallenge, type Entrant, type SubmitResult } from '@/components/arena/types';
import ArenaLayout from '@/layouts/arena-layout';
import { HttpError, postJson } from '@/lib/http';
import { playCorrect, playKey, playWrong } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { Head, usePoll } from '@inertiajs/react';
import { LoaderCircle, Rocket, Skull, Swords } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Props {
    challenge: ArenaChallenge;
    entrants: Entrant[];
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function ArenaGame({ challenge, entrants }: Props) {
    usePoll(challenge.status === 'active' ? 30000 : 4000, { only: ['challenge', 'entrants'] });

    const [entrantId, setEntrantId] = useState<number | null>(null);
    const [answer, setAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [overlay, setOverlay] = useState<{ result: 'correct' | 'wrong' | 'sent'; detail: string | null } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // Game sekali-jawab tidak membuka benar/salah di layar: hasil diumumkan di panggung.
    const revealResult = challenge.max_attempts !== 1;
    const type = challenge.game_type;

    const press = useCallback((key: string) => {
        playKey();
        setNotice(null);
        setAnswer((a) => (a.length >= 12 ? a : a + key));
    }, []);

    const submit = useCallback(async () => {
        if (!entrantId) return setNotice(challenge.competition_mode === 'team' ? 'Pilih kelompok terlebih dahulu.' : 'Pilih nama terlebih dahulu.');
        if (!answer.trim()) return setNotice('Isi jawaban terlebih dahulu.');

        setSubmitting(true);
        try {
            const res = await postJson<SubmitResult>(route('arena.submit', challenge.code), { entrant_id: entrantId, answer });
            if (revealResult) {
                if (res.correct) {
                    playCorrect();
                } else {
                    playWrong();
                }
                setOverlay({
                    result: res.correct ? 'correct' : 'wrong',
                    detail: res.attempts_left !== null && !res.correct ? `Sisa kesempatan: ${res.attempts_left}` : null,
                });
            } else {
                playCorrect();
                setOverlay({ result: 'sent', detail: 'Pantau pengumuman di panggung utama.' });
            }
        } catch (error) {
            playWrong();
            setNotice(error instanceof HttpError ? error.message : 'Gagal mengirim. Periksa koneksi.');
        } finally {
            setSubmitting(false);
        }
    }, [answer, challenge.code, challenge.competition_mode, entrantId, revealResult]);

    const closeOverlay = useCallback(() => {
        setOverlay(null);
        setAnswer('');
        setEntrantId(null);
    }, []);

    useEffect(() => {
        if (overlay || challenge.status !== 'active' || type !== 'numeric_keypad') return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'SELECT') return;
            if (/^[0-9]$/.test(e.key)) press(e.key);
            else if (e.key === 'Backspace') setAnswer((a) => a.slice(0, -1));
            else if (e.key === 'Escape') setAnswer('');
            else if (e.key === 'Enter') void submit();
            else return;
            e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [overlay, challenge.status, type, press, submit]);

    return (
        <ArenaLayout>
            <Head title={challenge.title} />

            <main className="mx-auto w-full max-w-[600px] rounded-2xl border border-red-600/40 bg-[#0F141F]/95 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(234,179,8,0.15)] backdrop-blur sm:p-8">
                <div className="mb-6 border-b border-white/10 pb-5 text-center">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold tracking-wider uppercase',
                            challenge.is_deathmatch ? 'bg-red-600/20 text-red-300' : 'bg-orange-500/20 text-orange-300',
                        )}
                    >
                        {challenge.is_deathmatch ? <Skull className="size-3.5" /> : <Swords className="size-3.5" />}
                        {challenge.is_deathmatch ? 'Deathmatch' : `Chapter ${challenge.chapter} · Main challenge`}
                    </span>
                    <h1 className="font-display mt-2 text-2xl font-bold tracking-wide uppercase">{challenge.title}</h1>
                    <p className="mt-1.5 text-sm text-slate-400">{challenge.description || 'Pilih namamu, masukkan jawaban yang tepat, lalu kirim.'}</p>
                </div>

                {challenge.status !== 'active' ? (
                    <ArenaStatusNotice status={challenge.status} />
                ) : (
                    <div className="space-y-6">
                        <EntrantPicker entrants={entrants} value={entrantId} onChange={setEntrantId} teamMode={challenge.competition_mode === 'team'} />

                        <div>
                            <p className="mb-2 text-center text-xs font-semibold tracking-wider text-amber-300 uppercase">Jawaban</p>

                            {type === 'choice' ? (
                                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Pilihan jawaban">
                                    {['A', 'B', 'C', 'D'].map((letter) => (
                                        <button
                                            key={letter}
                                            type="button"
                                            role="radio"
                                            aria-checked={answer === letter}
                                            onClick={() => {
                                                playKey();
                                                setAnswer(letter);
                                            }}
                                            className={cn(
                                                'rounded-xl border-2 py-6 text-3xl font-bold transition',
                                                answer === letter
                                                    ? 'border-amber-300 bg-amber-300/15 text-amber-300'
                                                    : 'border-white/10 bg-gradient-to-b from-slate-800 to-slate-900 hover:border-amber-300/60',
                                            )}
                                        >
                                            {letter}
                                        </button>
                                    ))}
                                </div>
                            ) : type === 'text_code' ? (
                                <input
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && void submit()}
                                    maxLength={200}
                                    autoComplete="off"
                                    placeholder="Ketik sandi jawaban"
                                    className="h-16 w-full rounded-xl border-2 border-red-600/40 bg-black/60 px-4 text-center font-mono text-2xl font-bold tracking-widest text-amber-300 outline-none placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-500 focus:border-amber-300"
                                />
                            ) : (
                                <>
                                    <div className="flex min-h-[4.5rem] items-center justify-center rounded-xl border-2 border-red-600/40 bg-black/60 p-4 font-mono text-3xl font-bold tracking-[0.25em] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                                        {answer ? <span className="text-amber-300">{answer}</span> : <span className="text-lg font-normal tracking-normal text-slate-500">Tekan angka…</span>}
                                    </div>
                                    <div className="mx-auto mt-5 grid max-w-[320px] grid-cols-3 gap-3">
                                        {KEYS.map((k) => (
                                            <KeypadButton key={k} onClick={() => press(k)}>
                                                {k}
                                            </KeypadButton>
                                        ))}
                                        <KeypadButton danger onClick={() => setAnswer('')} label="Hapus semua">
                                            C
                                        </KeypadButton>
                                        <KeypadButton onClick={() => press('0')}>0</KeypadButton>
                                        <KeypadButton danger onClick={() => setAnswer((a) => a.slice(0, -1))} label="Hapus satu">
                                            ⌫
                                        </KeypadButton>
                                    </div>
                                </>
                            )}
                        </div>

                        {notice && <p className="text-center text-sm font-medium text-red-300">{notice}</p>}

                        <button
                            type="button"
                            onClick={() => void submit()}
                            disabled={submitting}
                            className="mx-auto flex w-full max-w-[320px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-gradient-to-br from-[#FFC837] to-[#FF8008] py-3.5 font-bold text-black transition hover:-translate-y-0.5 active:translate-y-px disabled:opacity-60"
                        >
                            {submitting ? <LoaderCircle className="size-5 animate-spin" /> : <Rocket className="size-5" />}
                            Submit jawaban
                        </button>
                    </div>
                )}
            </main>

            {overlay && <ResultOverlay result={overlay.result} detail={overlay.detail} onClose={closeOverlay} />}
        </ArenaLayout>
    );
}

function KeypadButton({ children, onClick, danger, label }: { children: React.ReactNode; onClick: () => void; danger?: boolean; label?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
                'rounded-xl border py-4 text-xl font-extrabold shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition-all duration-150 hover:-translate-y-0.5 active:translate-y-px',
                danger
                    ? 'border-red-600/40 bg-red-600/20 text-red-300'
                    : 'border-white/10 bg-gradient-to-b from-slate-800 to-slate-900 hover:border-amber-300 hover:text-amber-300',
            )}
        >
            {children}
        </button>
    );
}
