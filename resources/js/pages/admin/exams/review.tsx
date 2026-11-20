import { AdjustScoreDialog, type SectionAdjustmentData } from '@/components/admin/adjust-score-dialog';
import { MathText } from '@/components/exam/math-text';
import { PageHeader } from '@/components/page-header';
import { PageSkeleton } from '@/components/page-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Deferred, Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Calculator, Check, CheckCircle2, FileCheck2, HelpCircle, User as UserIcon, X, XCircle } from 'lucide-react';
import { useState } from 'react';

interface OptionItem {
    id: number;
    position: number;
    label: string;
    content: string | null;
    image_url: string | null;
    is_correct: boolean;
    is_selected: boolean;
}

interface QuestionItem {
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
    options: OptionItem[];
    answered: boolean;
    selected_option_id: number | null;
    is_correct: boolean | null;
    score: number | null;
    answered_at: string | null;
}

interface GroupItem {
    id: number;
    title: string;
    kind: string | null;
    position: number;
    stimulus_type: string;
    stimulus_text: string | null;
    stimulus_media_url: string | null;
    questions: QuestionItem[];
}

interface SectionReview {
    id: number;
    attempt_section_id: number;
    pillar: string;
    label: string;
    duration_seconds: number;
    score: number;
    score_web: number;
    adjustment_type: 'addition' | 'overwrite' | null;
    manual_score: number;
    adjustment_notes: string | null;
    adjusted_by: string | null;
    adjusted_at: string | null;
    correct_count: number;
    wrong_count: number;
    answered_count: number;
    unanswered_count: number;
    total_questions: number;
    groups: GroupItem[];
}

interface Props {
    exam: { id: number; title: string };
    attempt: {
        id: number;
        status: string;
        status_label: string;
        score_total: number;
        correct_count: number;
        wrong_count: number;
        duration_seconds: number;
        tab_switch_count: number;
        submit_reason: string | null;
        started_at: string;
        submitted_at: string | null;
    };
    participant: {
        id: number;
        full_name: string;
        nim: string;
        building: string;
        room_number: string | null;
        major: string;
    };
    sections: SectionReview[];
}

type QuestionFilter = 'all' | 'correct' | 'wrong' | 'unanswered';

export default function AttemptReviewPage(props: Props) {
    return (
        <Deferred
            data="sections"
            fallback={
                <AppLayout>
                    <Head title={`Lembar Jawaban · ${props.participant.full_name}`} />
                    <PageSkeleton />
                </AppLayout>
            }
        >
            <AttemptReview key={props.attempt.id} {...props} />
        </Deferred>
    );
}

function AttemptReview({ exam, attempt, participant, sections }: Props) {
    const { auth } = usePage<SharedData>().props;
    const isAdmin = auth.user?.role === 'admin';

    const [activeSectionId, setActiveSectionId] = useState<number>(sections[0]?.id ?? 0);
    const [visibleCount, setVisibleCount] = useState(20);
    const [filter, setFilter] = useState<QuestionFilter>('all');
    const [adjustDialog, setAdjustDialog] = useState<{ open: boolean; section: SectionAdjustmentData | null }>({
        open: false,
        section: null,
    });

    const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0];

    // Flatten questions in active section for numbering & filtering
    const allQuestions = (activeSection?.groups ?? []).flatMap((g) => g.questions);
    const filteredQuestions = allQuestions.filter((q) => {
        if (filter === 'correct') return q.is_correct === true;
        if (filter === 'wrong') return q.is_correct === false;
        if (filter === 'unanswered') return !q.answered;
        return true;
    });

    const visibleQuestions = new Set(filteredQuestions.slice(0, visibleCount).map((q) => q.id));
    const questionNumbers = new Map(allQuestions.map((q, index) => [q.id, index + 1]));
    const changeFilter = (value: QuestionFilter) => {
        setFilter(value);
        setVisibleCount(20);
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Ujian & Bank Soal', href: '/admin/ujian' },
                { title: exam.title, href: route('admin.exams.results', exam.id) },
                { title: 'Hasil', href: route('admin.exams.results', exam.id) },
                { title: `Lembar Jawaban: ${participant.full_name}`, href: '#' },
            ]}
        >
            <Head title={`Lembar Jawaban · ${participant.full_name}`} />

            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={`Lembar Jawaban: ${participant.full_name}`}
                    description={`${participant.nim} · ${participant.building} · Total Skor: ${attempt.score_total} · Benar: ${attempt.correct_count} / Salah: ${attempt.wrong_count} · Durasi: ${formatDuration(attempt.duration_seconds)} · Pindah Tab: ${attempt.tab_switch_count}`}
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.exams.results', exam.id)}>
                                    <ArrowLeft className="size-4" /> Kembali ke Hasil
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <Link href={route('admin.participants.show', participant.id)}>
                                    <UserIcon className="size-4" /> Profil Peserta
                                </Link>
                            </Button>
                        </div>
                    }
                />

                {/* Subtest / Pilar Tab Selector */}
                <div className="flex flex-wrap gap-2 border-b pb-3">
                    {sections.map((s) => {
                        const isCurrent = s.id === activeSection?.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                    setActiveSectionId(s.id);
                                    changeFilter('all');
                                }}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                                    isCurrent
                                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                                        : 'border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <span>{s.label}</span>
                                <span className="bg-muted rounded px-1.5 py-0.5 text-[0.68rem] font-bold tabular-nums">{s.score} poin</span>
                                {s.adjustment_type === 'addition' && (
                                    <span className="py-0.2 rounded bg-emerald-500/20 px-1 text-[0.65rem] font-semibold text-emerald-700 dark:text-emerald-300">
                                        +{s.manual_score}
                                    </span>
                                )}
                                {s.adjustment_type === 'overwrite' && (
                                    <span className="py-0.2 rounded bg-amber-500/20 px-1 text-[0.65rem] font-semibold text-amber-700 dark:text-amber-300">
                                        Timpa
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {activeSection && (
                    <div className="space-y-6">
                        {/* Summary & Adjustment Banner for Active Section */}
                        <Card className="border-border bg-card">
                            <CardContent className="p-4 sm:p-5">
                                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base font-semibold">{activeSection.label}</h2>
                                            <span className="text-muted-foreground text-xs">
                                                ({activeSection.total_questions} Soal · Durasi {intdiv(activeSection.duration_seconds, 60)} Menit)
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                            <div>
                                                <span className="text-muted-foreground">Nilai Web: </span>
                                                <strong className="tabular-nums">{activeSection.score_web}</strong>
                                            </div>
                                            {activeSection.adjustment_type && (
                                                <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                                                    <span>Penyesuaian Manual:</span>
                                                    <span>
                                                        {activeSection.adjustment_type === 'addition'
                                                            ? `+${activeSection.manual_score} (Tambah Kertas)`
                                                            : `${activeSection.manual_score} (Timpa / Ujian Ulang)`}
                                                    </span>
                                                    {activeSection.adjusted_by && (
                                                        <span className="text-muted-foreground text-[0.7rem]">oleh {activeSection.adjusted_by}</span>
                                                    )}
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-muted-foreground">Nilai Akhir Pilar: </span>
                                                <strong className="text-primary text-sm tabular-nums">{activeSection.score}</strong>
                                            </div>
                                        </div>

                                        {activeSection.adjustment_notes && (
                                            <p className="text-muted-foreground text-xs italic">
                                                Catatan: &ldquo;{activeSection.adjustment_notes}&rdquo;
                                            </p>
                                        )}
                                    </div>

                                    {isAdmin && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="shrink-0"
                                            onClick={() =>
                                                setAdjustDialog({
                                                    open: true,
                                                    section: {
                                                        id: activeSection.id,
                                                        label: activeSection.label,
                                                        score: activeSection.score,
                                                        score_web: activeSection.score_web,
                                                        adjustment_type: activeSection.adjustment_type,
                                                        manual_score: activeSection.manual_score,
                                                        adjustment_notes: activeSection.adjustment_notes,
                                                    },
                                                })
                                            }
                                        >
                                            <Calculator className="size-3.5" /> Sesuaikan Nilai Pilar
                                        </Button>
                                    )}
                                </div>

                                {/* Quick Stats Breakdown */}
                                <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4">
                                    <div className="rounded-md border p-2 text-center text-xs">
                                        <span className="text-muted-foreground block text-[0.7rem]">Terjawab di Web</span>
                                        <strong className="text-foreground tabular-nums">
                                            {activeSection.answered_count} / {activeSection.total_questions}
                                        </strong>
                                    </div>
                                    <div className="rounded-md border p-2 text-center text-xs">
                                        <span className="text-muted-foreground block text-[0.7rem]">Kosong di Web</span>
                                        <strong
                                            className={cn(
                                                'tabular-nums',
                                                activeSection.unanswered_count > 0 ? 'font-semibold text-amber-600' : 'text-foreground',
                                            )}
                                        >
                                            {activeSection.unanswered_count}
                                        </strong>
                                    </div>
                                    <div className="rounded-md border p-2 text-center text-xs">
                                        <span className="text-muted-foreground block text-[0.7rem]">Jawaban Benar</span>
                                        <strong className="text-emerald-600 tabular-nums dark:text-emerald-400">{activeSection.correct_count}</strong>
                                    </div>
                                    <div className="rounded-md border p-2 text-center text-xs">
                                        <span className="text-muted-foreground block text-[0.7rem]">Jawaban Salah</span>
                                        <strong className="text-rose-600 tabular-nums dark:text-rose-400">{activeSection.wrong_count}</strong>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground mr-1">Filter Soal:</span>
                                <Button
                                    size="sm"
                                    variant={filter === 'all' ? 'default' : 'outline'}
                                    className="h-7 text-xs"
                                    onClick={() => changeFilter('all')}
                                >
                                    Semua ({allQuestions.length})
                                </Button>
                                <Button
                                    size="sm"
                                    variant={filter === 'correct' ? 'default' : 'outline'}
                                    className={cn('h-7 text-xs', filter !== 'correct' && 'text-emerald-600')}
                                    onClick={() => changeFilter('correct')}
                                >
                                    Benar ({activeSection.correct_count})
                                </Button>
                                <Button
                                    size="sm"
                                    variant={filter === 'wrong' ? 'default' : 'outline'}
                                    className={cn('h-7 text-xs', filter !== 'wrong' && 'text-rose-600')}
                                    onClick={() => changeFilter('wrong')}
                                >
                                    Salah ({activeSection.wrong_count})
                                </Button>
                                <Button
                                    size="sm"
                                    variant={filter === 'unanswered' ? 'default' : 'outline'}
                                    className={cn('h-7 text-xs', filter !== 'unanswered' && 'text-amber-600')}
                                    onClick={() => changeFilter('unanswered')}
                                >
                                    Kosong di Web ({activeSection.unanswered_count})
                                </Button>
                            </div>

                            <div className="text-muted-foreground text-xs">
                                Menampilkan {Math.min(visibleCount, filteredQuestions.length)} dari {allQuestions.length} soal
                            </div>
                        </div>

                        {/* Question List */}
                        <div className="space-y-4">
                            {filteredQuestions.length === 0 && (
                                <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                                    Tidak ada soal yang cocok dengan filter yang dipilih.
                                </div>
                            )}

                            {activeSection.groups.map((group) => {
                                const groupQuestions = group.questions.filter((q) => visibleQuestions.has(q.id));
                                if (groupQuestions.length === 0) return null;

                                return (
                                    <div key={group.id} className="space-y-3">
                                        {group.title && (
                                            <div className="flex items-center gap-2 pt-2">
                                                <FileCheck2 className="text-muted-foreground size-4" />
                                                <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                                    {group.title} {group.kind ? `(${group.kind})` : ''}
                                                </h3>
                                            </div>
                                        )}

                                        {/* Stimulus jika ada */}
                                        {group.stimulus_text && (
                                            <div className="bg-muted/30 rounded-lg border p-3 text-xs leading-relaxed">
                                                <span className="text-muted-foreground mb-1 block text-[0.65rem] font-semibold uppercase">
                                                    Materi Observasi / Teks Bacaan
                                                </span>
                                                <div className="whitespace-pre-wrap">{group.stimulus_text}</div>
                                            </div>
                                        )}

                                        {groupQuestions.map((q) => {
                                            const questionNumber = questionNumbers.get(q.id);

                                            return (
                                                <Card key={q.id} className="border-border bg-card">
                                                    <CardContent className="space-y-3 p-4 sm:p-5">
                                                        <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="bg-muted flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums">
                                                                    {questionNumber}
                                                                </span>
                                                                <span className="text-muted-foreground text-xs">
                                                                    Bobot: +{q.points} / -{q.penalty}
                                                                </span>
                                                            </div>

                                                            <div>
                                                                {q.answered ? (
                                                                    q.is_correct ? (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                                        >
                                                                            <CheckCircle2 className="size-3" /> Benar (+{q.points})
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="gap-1 border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                                                        >
                                                                            <XCircle className="size-3" /> Salah (-{q.penalty})
                                                                        </Badge>
                                                                    )
                                                                ) : (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                                                    >
                                                                        <HelpCircle className="size-3" /> Kosong di Web (Cek Kertas)
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Isi Soal */}
                                                        <div className="text-sm leading-relaxed font-medium">
                                                            <MathText text={q.body} latex={q.is_latex} />
                                                        </div>

                                                        {/* Gambar Soal jika ada */}
                                                        {q.image_url && (
                                                            <div className="bg-muted max-w-md overflow-hidden rounded-lg border">
                                                                <img
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    src={q.image_url}
                                                                    alt=""
                                                                    className="max-h-60 object-contain p-1"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Pilihan Opsi Jawaban */}
                                                        <div className="grid gap-2 pt-1 sm:grid-cols-2">
                                                            {q.options.map((opt) => {
                                                                const isChosen = opt.is_selected;
                                                                const isKey = opt.is_correct;

                                                                return (
                                                                    <div
                                                                        key={opt.id}
                                                                        className={cn(
                                                                            'relative flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-colors',
                                                                            isKey &&
                                                                                isChosen &&
                                                                                'border-emerald-500 bg-emerald-500/10 font-medium text-emerald-950 dark:text-emerald-100',
                                                                            isChosen &&
                                                                                !isKey &&
                                                                                'border-rose-500 bg-rose-500/10 font-medium text-rose-950 dark:text-rose-100',
                                                                            isKey &&
                                                                                !isChosen &&
                                                                                'text-foreground border-emerald-500/50 bg-emerald-500/5',
                                                                            !isKey && !isChosen && 'border-border bg-card text-muted-foreground',
                                                                        )}
                                                                    >
                                                                        <span
                                                                            className={cn(
                                                                                'flex size-5 shrink-0 items-center justify-center rounded text-[0.7rem] font-bold',
                                                                                isKey
                                                                                    ? 'bg-emerald-600 text-white'
                                                                                    : isChosen
                                                                                      ? 'bg-rose-600 text-white'
                                                                                      : 'bg-muted text-muted-foreground',
                                                                            )}
                                                                        >
                                                                            {opt.label}
                                                                        </span>

                                                                        <div className="flex-1 space-y-1">
                                                                            {opt.image_url ? (
                                                                                <img
                                                                                    loading="lazy"
                                                                                    decoding="async"
                                                                                    src={opt.image_url}
                                                                                    alt=""
                                                                                    className="max-h-24 rounded border object-contain p-1"
                                                                                />
                                                                            ) : (
                                                                                <span>{opt.content}</span>
                                                                            )}

                                                                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                                                {isKey && (
                                                                                    <span className="inline-flex items-center gap-0.5 text-[0.65rem] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                                        <Check className="size-2.5" /> Kunci Jawaban
                                                                                    </span>
                                                                                )}
                                                                                {isChosen && (
                                                                                    <span
                                                                                        className={cn(
                                                                                            'inline-flex items-center gap-0.5 rounded px-1 text-[0.65rem] font-semibold',
                                                                                            isKey
                                                                                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                                                                                : 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
                                                                                        )}
                                                                                    >
                                                                                        {isKey ? (
                                                                                            <Check className="size-2.5" />
                                                                                        ) : (
                                                                                            <X className="size-2.5" />
                                                                                        )}{' '}
                                                                                        Dipilih Peserta
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Waktu Jawab jika ada */}
                                                        {q.answered_at && (
                                                            <div className="text-muted-foreground pt-1 text-[0.7rem]">
                                                                Dijawab pada: {new Date(q.answered_at).toLocaleTimeString('id-ID')}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                        {filteredQuestions.length > visibleCount && (
                            <Button variant="outline" onClick={() => setVisibleCount((count) => count + 20)}>
                                Tampilkan 20 soal berikutnya
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Dialog Koreksi Manual Nilai */}
            {adjustDialog.open && (
                <AdjustScoreDialog
                    open={adjustDialog.open}
                    onOpenChange={(open) => setAdjustDialog((prev) => ({ ...prev, open }))}
                    examId={exam.id}
                    attemptId={attempt.id}
                    section={adjustDialog.section}
                    participantName={participant.full_name}
                />
            )}
        </AppLayout>
    );
}

function intdiv(a: number, b: number): number {
    return Math.floor(a / b);
}
