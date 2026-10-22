import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Crown, Download, Eye, EyeOff, Sparkles } from 'lucide-react';

interface Row {
    attempt_id: number;
    rank: number;
    building_rank: number;
    participant_id: number;
    full_name: string;
    nim: string;
    major: string;
    building: string;
    section_scores: Record<string, number | null>;
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
    rows: Row[];
    buildings: { id: number; name: string }[];
    filters: { building: number | null };
    castRules: { global_keep: number; per_building: number };
    pillars: { value: string; label: string }[];
}

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

export default function Results({ exam, rows, buildings, filters, castRules, pillars }: Props) {
    const { auth } = usePage<SharedData>().props;
    const isAdmin = auth.user?.role === 'admin';

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
                    description={`Urutan: skor total tertinggi, lalu durasi tersingkat. Cast = Top ${castRules.global_keep} global + ${castRules.per_building} besar tiap gedung dari sisanya.${exam.cast_applied ? '' : ' Label bergaris putus-putus adalah pratinjau, belum ditetapkan.'}`}
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
                                    onClick={() =>
                                        confirm(
                                            `Tetapkan cast sesuai aturan (Top ${castRules.global_keep} global + ${castRules.per_building} per gedung)? Status peserta terpilih menjadi "Cast".`,
                                        ) && router.post(route('admin.exams.cast.apply', exam.id), {}, { preserveScroll: true })
                                    }
                                >
                                    <Crown /> {exam.cast_applied ? 'Tetapkan ulang cast' : 'Tetapkan cast'}
                                </Button>
                            )}
                            {isAdmin && (
                                <Button variant="outline" onClick={() => router.patch(route('admin.exams.publish', exam.id), {}, { preserveScroll: true })}>
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

                <div className="max-w-xs">
                    <NativeSelect
                        aria-label="Filter gedung"
                        value={filters.building ?? ''}
                        onChange={(e) => router.get(route('admin.exams.results', exam.id), e.target.value ? { building: e.target.value } : {}, { preserveState: true })}
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
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <EmptyRow colSpan={10 + exam.sections.length}>Belum ada peserta yang menyelesaikan ujian.</EmptyRow>}
                        {rows.map((r) => {
                            const castType = exam.cast_applied ? r.cast_type : r.cast_preview;
                            const cast = castType !== null;
                            return (
                                <Tr key={r.attempt_id} className={cn(cast && 'bg-amber-500/5')}>
                                    <Td className="text-right font-semibold tabular-nums">{r.rank}</Td>
                                    <Td className="text-right tabular-nums">
                                        <span className={cn(cast && 'rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300')}>{r.building_rank}</span>
                                    </Td>
                                    <Td className="min-w-52">
                                        <Link href={route('admin.participants.show', r.participant_id)} className="font-medium hover:underline">
                                            {r.full_name}
                                        </Link>
                                        <p className="text-muted-foreground text-xs">
                                            {r.nim} · {r.building}
                                        </p>
                                    </Td>
                                    {exam.sections.map((s) => (
                                        <Td key={s.id} className="text-right tabular-nums">
                                            {r.section_scores[s.id] ?? 0}
                                        </Td>
                                    ))}
                                    <Td className="text-right text-base font-semibold tabular-nums">{r.score_total}</Td>
                                    <Td className="text-muted-foreground text-right whitespace-nowrap tabular-nums">
                                        {r.correct_count} / {r.wrong_count}
                                    </Td>
                                    <Td className="text-muted-foreground text-right whitespace-nowrap">{formatDuration(r.duration_seconds)}</Td>
                                    <Td className={cn('text-right tabular-nums', r.tab_switch_count >= 3 && 'text-destructive font-semibold')}>{r.tab_switch_count}</Td>
                                    <Td>
                                        <CastBadge type={castType} preview={!exam.cast_applied} />
                                    </Td>
                                    {isAdmin && (
                                        <Td>
                                            <select
                                                aria-label={`Spesialis ${r.full_name}`}
                                                value={r.specialist_pillar ?? ''}
                                                onChange={(e) =>
                                                    router.patch(route('admin.attempts.specialist', [exam.id, r.attempt_id]), { pillar: e.target.value || null }, { preserveScroll: true })
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
                                </Tr>
                            );
                        })}
                    </tbody>
                </DataTable>
            </div>
        </AppLayout>
    );
}
