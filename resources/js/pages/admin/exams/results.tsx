import { AdjustScoreDialog, type SectionAdjustmentData } from '@/components/admin/adjust-score-dialog';
import { useConfirmation } from '@/components/confirmation-provider';
import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { PageSkeleton } from '@/components/page-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearProgressiveCache, useProgressiveDataset } from '@/hooks/use-progressive-dataset';
import AppLayout from '@/layouts/app-layout';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import { Crown, Download, Eye, EyeOff, FileText, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

interface SectionAdjustmentItem {
    attempt_section_id: number;
    score: number;
    score_web: number;
    adjustment_type: 'addition' | 'overwrite' | null;
    manual_score: number;
    adjustment_notes: string | null;
}

interface Row {
    attempt_id: number;
    rank: number;
    building_rank: number;
    participant_id: number;
    full_name: string;
    nim: string;
    major: string;
    building_id?: number;
    building: string;
    section_scores: Record<string, number | null>;
    section_adjustments?: Record<string, SectionAdjustmentItem>;
    score_total: number;
    correct_count: number;
    wrong_count: number;
    duration_seconds: number;
    tab_switch_count: number;
    submit_reason: string | null;
    cast_type: 'global' | 'building' | null;
    cast_preview: 'global' | 'building' | null;
    specialist_pillar: string | null;
}

interface Props {
    exam: { id: number; title: string; results_published: boolean; cast_applied: boolean; sections: { id: number; label: string }[] };
    results: { rows: Row[]; page: number; last_page: number; total: number; cohort_total?: number; signature?: string };
    buildings: { id: number; name: string }[];
    filters: { building: number | null };
    castRules: { global_keep: number; per_building: number };
    pillars: { value: string; label: string }[];
}

const PER_PAGE = 50;

function CastBadge({ type, preview }: { type: 'global' | 'building' | null; preview?: boolean }) {
    if (!type) return null;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap',
                type === 'global' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
                preview && 'border border-dashed border-current bg-transparent',
            )}
        >
            <Crown className="size-3" />
            {type === 'global' ? 'Top global' : 'Cast gedung'}
        </span>
    );
}

export default function ResultsPage(props: Props) {
    return (
        <Deferred
            data="results"
            fallback={
                <AppLayout>
                    <Head title={`Hasil · ${props.exam.title}`} />
                    <PageSkeleton />
                </AppLayout>
            }
        >
            <Results {...props} />
        </Deferred>
    );
}

function Results({ exam, results, buildings, filters, castRules, pillars }: Props) {
    const { confirm } = useConfirmation();
    const { auth } = usePage<SharedData>().props;
    const isAdmin = auth.user?.role === 'admin';

    const [search, setSearch] = useState('');
    const [building, setBuilding] = useState<string>(filters.building ? String(filters.building) : '');
    const [page, setPage] = useState<number>(results.page ?? 1);

    const cohortTotal = results.cohort_total ?? results.total;
    const signature = results.signature ?? `${exam.id}:${cohortTotal}:${results.rows[0]?.score_total ?? 0}`;
    const storageKey = `cod_exam_results_${exam.id}`;

    const { items: allRows, isSyncing } = useProgressiveDataset<Row>({
        storageKey,
        signature,
        initialItems: results.rows,
        total: cohortTotal,
        fetchUrl: route('admin.exams.results', exam.id),
        batchSize: 200,
        getKey: (item) => item.attempt_id,
    });

    const buildingNameById = useMemo(
        () => new Map(buildings.map((b) => [String(b.id), b.name])),
        [buildings],
    );

    const sortedAllRows = useMemo(
        () => [...allRows].sort((a, b) => a.rank - b.rank),
        [allRows],
    );

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        const targetBuildingName = building ? buildingNameById.get(building) : null;

        return sortedAllRows.filter((r) => {
            if (building) {
                const matchId = r.building_id !== undefined && String(r.building_id) === building;
                const matchName = targetBuildingName ? r.building === targetBuildingName : false;
                if (!matchId && !matchName) return false;
            }
            if (q) {
                const inName = r.full_name.toLowerCase().includes(q);
                const inNim = r.nim.toLowerCase().includes(q);
                const inMajor = r.major.toLowerCase().includes(q);
                if (!inName && !inNim && !inMajor) return false;
            }
            return true;
        });
    }, [sortedAllRows, search, building, buildingNameById]);

    const lastPage = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE));
    const safePage = Math.min(Math.max(1, page), lastPage);
    const rows = useMemo(
        () => filteredRows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
        [filteredRows, safePage],
    );

    const [adjustDialog, setAdjustDialog] = useState<{
        open: boolean;
        attemptId: number;
        participantName: string;
        section: SectionAdjustmentData | null;
    }>({
        open: false,
        attemptId: 0,
        participantName: '',
        section: null,
    });

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Ujian & Bank Soal', href: '/admin/ujian' },
                { title: exam.title, href: auth.user?.role === 'admin' ? route('admin.exams.edit', exam.id) : '#' },
                { title: 'Hasil', href: route('admin.exams.results', exam.id) },
            ]}
        >
            <Head title={`Hasil · ${exam.title}`} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Hasil & peringkat"
                    description={
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <span>
                                {`Urutan: skor total tertinggi, lalu durasi tersingkat. Cast = Top ${castRules.global_keep} global + ${castRules.per_building} besar tiap gedung dari sisanya.${exam.cast_applied ? '' : ' Label bergaris putus-putus adalah pratinjau, belum ditetapkan.'}`}
                            </span>
                            {isSyncing && (
                                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                                    <LoaderCircle className="size-3 animate-spin" /> Menyinkronkan data ({allRows.length}/{cohortTotal})
                                </span>
                            )}
                        </span>
                    }
                    actions={
                        <>
                            <Button asChild variant="outline">
                                <Link href={route('admin.exams.cast-reveal', exam.id)}>
                                    <Sparkles /> Cast reveal
                                </Link>
                            </Button>
                            {isAdmin && (
                                <Button
                                    variant="outline"
                                    onClick={async () =>
                                        (await confirm(
                                            `Tetapkan cast sesuai aturan (Top ${castRules.global_keep} global + ${castRules.per_building} per gedung)? Status peserta terpilih menjadi "Cast".`,
                                        )) &&
                                        router.post(
                                            route('admin.exams.cast.apply', exam.id),
                                            {},
                                            {
                                                preserveScroll: true,
                                                onSuccess: () => clearProgressiveCache(storageKey),
                                            },
                                        )
                                    }
                                >
                                    <Crown /> {exam.cast_applied ? 'Tetapkan ulang cast' : 'Tetapkan cast'}
                                </Button>
                            )}
                            {isAdmin && (
                                <Button
                                    variant="outline"
                                    onClick={() => router.patch(route('admin.exams.publish', exam.id), {}, { preserveScroll: true })}
                                >
                                    {exam.results_published ? <EyeOff /> : <Eye />}
                                    {exam.results_published ? 'Tarik publikasi' : 'Publikasikan ke peserta'}
                                </Button>
                            )}
                            <Button asChild>
                                <a href={route('admin.exams.results.export', exam.id)}>
                                    <Download /> Ekspor CSV
                                </a>
                            </Button>
                        </>
                    }
                />

                <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            className="pl-9"
                            placeholder="Cari nama, NIM, prodi"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <NativeSelect
                        aria-label="Filter gedung"
                        value={building}
                        onChange={(e) => {
                            setBuilding(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">Semua gedung</option>
                        {buildings.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </NativeSelect>
                </div>

                <DataTable>
                    <thead>
                        <tr>
                            <Th className="text-right">#</Th>
                            <Th className="text-right">#Gedung</Th>
                            <Th>Peserta</Th>
                            {exam.sections.map((s) => (
                                <Th key={s.id} className="text-right">
                                    {s.label}
                                </Th>
                            ))}
                            <Th className="text-right">Total</Th>
                            <Th className="text-right">B / S</Th>
                            <Th className="text-right">Durasi</Th>
                            <Th className="text-right">Tab</Th>
                            <Th>Cast</Th>
                            {isAdmin && <Th>Spesialis</Th>}
                            <Th className="text-right">Aksi</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <EmptyRow colSpan={11 + exam.sections.length}>
                                {allRows.length === 0
                                    ? 'Belum ada peserta yang menyelesaikan ujian.'
                                    : 'Tidak ada peserta yang cocok dengan pencarian atau filter.'}
                            </EmptyRow>
                        )}
                        {rows.map((r) => {
                            const castType = exam.cast_applied ? r.cast_type : r.cast_preview;
                            const cast = castType !== null;
                            return (
                                <Tr key={r.attempt_id} className={cn(cast && 'bg-amber-500/5')}>
                                    <Td className="text-right font-semibold tabular-nums">{r.rank}</Td>
                                    <Td className="text-right tabular-nums">
                                        <span
                                            className={cn(
                                                cast && 'rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300',
                                            )}
                                        >
                                            {r.building_rank}
                                        </span>
                                    </Td>
                                    <Td className="min-w-52">
                                        <Link href={route('admin.participants.show', r.participant_id)} className="font-medium hover:underline">
                                            {r.full_name}
                                        </Link>
                                        <p className="text-muted-foreground text-xs">
                                            {r.nim} · {r.building}
                                        </p>
                                    </Td>
                                    {exam.sections.map((s) => {
                                        const adj = r.section_adjustments?.[s.id];
                                        const isAdjusted = adj && adj.adjustment_type !== null;
                                        const scoreVal = r.section_scores[s.id] ?? 0;

                                        return (
                                            <Td key={s.id} className="text-right tabular-nums">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isAdmin ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setAdjustDialog({
                                                                    open: true,
                                                                    attemptId: r.attempt_id,
                                                                    participantName: r.full_name,
                                                                    section: {
                                                                        id: s.id,
                                                                        label: s.label,
                                                                        score: scoreVal,
                                                                        score_web: adj?.score_web ?? scoreVal,
                                                                        adjustment_type: adj?.adjustment_type ?? null,
                                                                        manual_score: adj?.manual_score ?? 0,
                                                                        adjustment_notes: adj?.adjustment_notes ?? null,
                                                                    },
                                                                })
                                                            }
                                                            className="group hover:text-primary inline-flex cursor-pointer items-center gap-1 transition-colors"
                                                            title={
                                                                isAdjusted
                                                                    ? `Disesuaikan (${adj?.adjustment_type === 'addition' ? 'Tambah' : 'Timpa'}): Web ${adj?.score_web}${adj?.adjustment_notes ? ` - "${adj.adjustment_notes}"` : ''} - Klik untuk ubah`
                                                                    : 'Klik untuk sesuaikan nilai'
                                                            }
                                                        >
                                                            <span
                                                                className={cn(isAdjusted && 'text-primary font-semibold underline decoration-dotted')}
                                                            >
                                                                {scoreVal}
                                                            </span>
                                                            {isAdjusted && (
                                                                <span className="py-0.2 rounded bg-amber-500/15 px-1 text-[0.65rem] font-semibold text-amber-700 dark:text-amber-300">
                                                                    {adj?.adjustment_type === 'addition' ? `+${adj.manual_score}` : 'Timpa'}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span>{scoreVal}</span>
                                                    )}
                                                </div>
                                            </Td>
                                        );
                                    })}
                                    <Td className="text-right text-base font-semibold tabular-nums">{r.score_total}</Td>
                                    <Td className="text-muted-foreground text-right whitespace-nowrap tabular-nums">
                                        {r.correct_count} / {r.wrong_count}
                                    </Td>
                                    <Td className="text-muted-foreground text-right whitespace-nowrap">{formatDuration(r.duration_seconds)}</Td>
                                    <Td className={cn('text-right tabular-nums', r.tab_switch_count >= 3 && 'text-destructive font-semibold')}>
                                        {r.tab_switch_count}
                                    </Td>
                                    <Td>
                                        <CastBadge type={castType} preview={!exam.cast_applied} />
                                    </Td>
                                    {isAdmin && (
                                        <Td>
                                            <select
                                                aria-label={`Spesialis ${r.full_name}`}
                                                value={r.specialist_pillar ?? ''}
                                                onChange={(e) =>
                                                    router.patch(
                                                        route('admin.attempts.specialist', [exam.id, r.attempt_id]),
                                                        { pillar: e.target.value || null },
                                                        {
                                                            preserveScroll: true,
                                                            onSuccess: () => clearProgressiveCache(storageKey),
                                                        },
                                                    )
                                                }
                                                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                                            >
                                                <option value="">—</option>
                                                {pillars.map((p) => (
                                                    <option key={p.value} value={p.value}>
                                                        {p.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </Td>
                                    )}
                                    <Td className="text-right whitespace-nowrap">
                                        <Button asChild size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs">
                                            <Link
                                                prefetch
                                                href={route('admin.attempts.review', [exam.id, r.attempt_id])}
                                                title="Lihat jawaban tiap butir soal"
                                            >
                                                <FileText className="size-3.5" /> Jawaban
                                            </Link>
                                        </Button>
                                    </Td>
                                </Tr>
                            );
                        })}
                    </tbody>
                </DataTable>
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                        {filteredRows.length} peserta · Halaman {safePage} dari {lastPage}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={safePage <= 1}
                            onClick={() => setPage((curr) => Math.max(1, curr - 1))}
                        >
                            Sebelumnya
                        </Button>
                        <Button
                            variant="outline"
                            disabled={safePage >= lastPage}
                            onClick={() => setPage((curr) => Math.min(lastPage, curr + 1))}
                        >
                            Berikutnya
                        </Button>
                    </div>
                </div>
            </div>

            {/* Dialog Koreksi / Penyesuaian Nilai */}
            {adjustDialog.open && (
                <AdjustScoreDialog
                    open={adjustDialog.open}
                    onOpenChange={(open) => setAdjustDialog((prev) => ({ ...prev, open }))}
                    examId={exam.id}
                    attemptId={adjustDialog.attemptId}
                    section={adjustDialog.section}
                    participantName={adjustDialog.participantName}
                />
            )}
        </AppLayout>
    );
}
