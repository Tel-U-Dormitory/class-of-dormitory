import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useServerClock } from '@/hooks/use-server-clock';
import AppLayout from '@/layouts/app-layout';
import { formatClock, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage, usePoll } from '@inertiajs/react';
import { Activity, CheckCircle2, Coffee, Eye, MoreHorizontal, Radio, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface AttemptRow {
    id: number;
    participant: { id: number; full_name: string; nim: string; building: string };
    status: 'in_progress' | 'on_break' | 'submitted';
    status_label: string;
    current_section: string | null;
    section_index: number | false;
    deadline_at: number | null;
    break_ends_at: number | null;
    answered_count: number;
    tab_switch_count: number;
    last_seen_at: number | null;
    score_total: number | null;
    submit_reason: string | null;
}

interface Props {
    exam: { id: number; title: string; status: string; status_label: string; sections: { id: number; label: string }[]; total_questions: number };
    attempts: AttemptRow[];
    serverNow: number;
    pollSeconds: number;
}

export default function Monitor({ exam, attempts, serverNow, pollSeconds }: Props) {
    usePoll(pollSeconds * 1000, { only: ['attempts', 'serverNow'] });
    const now = useServerClock(serverNow, 1000);
    const { auth } = usePage<SharedData>().props;
    const isAdmin = auth.user?.role === 'admin';

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'submitted' | 'flagged'>('all');

    const rows = useMemo(
        () =>
            attempts.filter((a) => {
                const q = search.toLowerCase();
                const matches = !q || a.participant.full_name.toLowerCase().includes(q) || a.participant.nim.includes(q) || a.participant.building.toLowerCase().includes(q);
                const status =
                    filter === 'all' ||
                    (filter === 'active' && a.status !== 'submitted') ||
                    (filter === 'submitted' && a.status === 'submitted') ||
                    (filter === 'flagged' && a.tab_switch_count >= 3);
                return matches && status;
            }),
        [attempts, search, filter],
    );

    const counts = {
        active: attempts.filter((a) => a.status === 'in_progress').length,
        break: attempts.filter((a) => a.status === 'on_break').length,
        submitted: attempts.filter((a) => a.status === 'submitted').length,
        flagged: attempts.filter((a) => a.tab_switch_count >= 3).length,
    };

    const extend = (a: AttemptRow) => {
        const minutes = Number(prompt(`Tambah waktu pilar ${a.current_section} untuk ${a.participant.full_name} (menit):`, '5'));
        if (minutes > 0) router.post(route('admin.attempts.extend', [exam.id, a.id]), { minutes }, { preserveScroll: true });
    };
    const forceSubmit = (a: AttemptRow) => {
        if (confirm(`Hentikan ujian ${a.participant.full_name}? Jawaban yang ada langsung dinilai.`)) {
            router.post(route('admin.attempts.force-submit', [exam.id, a.id]), {}, { preserveScroll: true });
        }
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Ujian & Bank Soal', href: '/admin/ujian' },
                { title: exam.title, href: isAdmin ? route('admin.exams.edit', exam.id) : '#' },
                { title: 'Monitor', href: route('admin.exams.monitor', exam.id) },
            ]}
        >
            <Head title={`Monitor · ${exam.title}`} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Monitor live"
                    description={
                        <span className="flex items-center gap-2">
                            <Radio className="size-4 animate-pulse text-emerald-500" /> Diperbarui otomatis tiap {pollSeconds} detik ·
                            <StatusBadge status={exam.status} label={exam.status_label} />
                        </span>
                    }
                    actions={
                        <Button asChild variant="outline">
                            <Link href={route('admin.exams.results', exam.id)}>Lihat hasil</Link>
                        </Button>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Sedang mengerjakan" value={counts.active} icon={Activity} />
                    <StatCard label="Sedang jeda" value={counts.break} icon={Coffee} />
                    <StatCard label="Selesai" value={counts.submitted} icon={CheckCircle2} />
                    <StatCard label="Pindah tab ≥ 3×" value={counts.flagged} icon={Eye} className={counts.flagged > 0 ? 'border-destructive/40' : ''} />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-sm flex-1">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input className="pl-9" placeholder="Cari nama, NIM, gedung" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-1">
                        {(
                            [
                                ['all', 'Semua'],
                                ['active', 'Aktif'],
                                ['submitted', 'Selesai'],
                                ['flagged', 'Mencurigakan'],
                            ] as const
                        ).map(([key, label]) => (
                            <Button key={key} size="sm" variant={filter === key ? 'secondary' : 'ghost'} onClick={() => setFilter(key)}>
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>

                <DataTable>
                    <thead>
                        <tr>
                            <Th>Peserta</Th>
                            <Th>Status</Th>
                            <Th>Progres pilar</Th>
                            <Th className="text-right">Sisa waktu</Th>
                            <Th className="text-right">Terjawab</Th>
                            <Th className="text-right">Pindah tab</Th>
                            <Th>Aktivitas</Th>
                            {isAdmin && <Th />}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <EmptyRow colSpan={8}>Belum ada peserta yang memulai ujian.</EmptyRow>}
                        {rows.map((a) => {
                            const timeLeft = a.status === 'in_progress' && a.deadline_at ? (a.deadline_at - now) / 1000 : a.status === 'on_break' && a.break_ends_at ? (a.break_ends_at - now) / 1000 : null;
                            const stale = a.status !== 'submitted' && a.last_seen_at && now - a.last_seen_at > 90_000;
                            return (
                                <Tr key={a.id}>
                                    <Td>
                                        <Link href={route('admin.participants.show', a.participant.id)} className="font-medium hover:underline">
                                            {a.participant.full_name}
                                        </Link>
                                        <p className="text-muted-foreground text-xs">
                                            {a.participant.nim} · {a.participant.building}
                                        </p>
                                    </Td>
                                    <Td>
                                        <StatusBadge status={a.status} label={a.status_label} />
                                        {a.submit_reason && <p className="text-muted-foreground mt-1 text-xs">{a.submit_reason}</p>}
                                    </Td>
                                    <Td>
                                        <div className="flex gap-1" aria-label={a.current_section ?? 'Selesai'}>
                                            {exam.sections.map((s, i) => {
                                                const idx = a.section_index === false ? exam.sections.length : a.section_index;
                                                const done = a.status === 'submitted' || i < idx;
                                                const currentSection = a.status === 'in_progress' && i === idx;
                                                return (
                                                    <span
                                                        key={s.id}
                                                        title={s.label}
                                                        className={cn('h-1.5 w-6 rounded-full', done ? 'bg-emerald-500' : currentSection ? 'bg-primary' : 'bg-muted')}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <p className="text-muted-foreground mt-1 text-xs">{a.status === 'submitted' ? 'Selesai' : (a.current_section ?? '—')}</p>
                                    </Td>
                                    <Td className="text-right font-mono tabular-nums">{timeLeft !== null ? formatClock(timeLeft) : '—'}</Td>
                                    <Td className="text-right tabular-nums">
                                        {a.answered_count}/{exam.total_questions}
                                    </Td>
                                    <Td className={cn('text-right tabular-nums', a.tab_switch_count >= 3 && 'text-destructive font-semibold')}>{a.tab_switch_count}</Td>
                                    <Td className={cn('text-xs', stale ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                                        {formatRelative(a.last_seen_at, now)}
                                    </Td>
                                    {isAdmin && (
                                        <Td className="text-right">
                                            {a.status !== 'submitted' && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button size="icon" variant="ghost" aria-label="Aksi">
                                                            <MoreHorizontal />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>{a.participant.full_name}</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem disabled={a.status !== 'in_progress'} onSelect={() => extend(a)}>
                                                            Tambah waktu pilar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onSelect={() => forceSubmit(a)}>
                                                            Hentikan & nilai
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
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
