import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Download, Eye, EyeOff } from 'lucide-react';

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
}

interface Props {
    exam: { id: number; title: string; results_published: boolean; sections: { id: number; label: string }[] };
    rows: Row[];
    buildings: { id: number; name: string }[];
    filters: { building: number | null };
}

/** Kandidat cast: 4 besar per gedung (aturan final ditetapkan panitia). */
const CAST_PER_BUILDING = 4;

export default function Results({ exam, rows, buildings, filters }: Props) {
    const { auth } = usePage<SharedData>().props;

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
                    description="Urutan: skor total tertinggi, lalu durasi pengerjaan tersingkat. Baris bertanda adalah 4 besar di gedungnya."
                    actions={
                        <>
                            {auth.user?.role === 'admin' && (
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
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <EmptyRow colSpan={8 + exam.sections.length}>Belum ada peserta yang menyelesaikan ujian.</EmptyRow>}
                        {rows.map((r) => {
                            const cast = r.building_rank <= CAST_PER_BUILDING;
                            return (
                                <Tr key={r.attempt_id} className={cn(cast && 'bg-amber-500/5')}>
                                    <Td className="text-right font-semibold tabular-nums">{r.rank}</Td>
                                    <Td className="text-right tabular-nums">
                                        <span className={cn(cast && 'rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300')}>{r.building_rank}</span>
                                    </Td>
                                    <Td>
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
                                    <Td className="text-muted-foreground text-right tabular-nums">
                                        {r.correct_count} / {r.wrong_count}
                                    </Td>
                                    <Td className="text-muted-foreground text-right whitespace-nowrap">{formatDuration(r.duration_seconds)}</Td>
                                    <Td className={cn('text-right tabular-nums', r.tab_switch_count >= 3 && 'text-destructive font-semibold')}>{r.tab_switch_count}</Td>
                                </Tr>
                            );
                        })}
                    </tbody>
                </DataTable>
            </div>
        </AppLayout>
    );
}
