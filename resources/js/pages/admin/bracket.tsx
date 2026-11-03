import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type Option, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Search, UserRound } from 'lucide-react';
import { useState } from 'react';

interface Row {
    id: number;
    full_name: string;
    nim: string;
    building_id: number;
    building: string;
    status: string;
    status_label: string;
    photo_url: string | null;
}

interface Props {
    participants: Row[];
    counts: Record<string, number>;
    statuses: Option[];
    buildings: { id: number; name: string }[];
}

const actions = [
    { status: 'advanced', label: 'Lolos' },
    { status: 'deathmatch', label: 'Deathmatch' },
    { status: 'eliminated', label: 'Eliminasi' },
];

export default function Bracket({ participants, counts, statuses, buildings }: Props) {
    const { auth } = usePage<SharedData>().props;
    const isAdmin = auth.user?.role === 'admin';
    const [status, setStatus] = useState('');
    const [building, setBuilding] = useState('');
    const [search, setSearch] = useState('');

    const rows = participants.filter(
        (p) =>
            (!status || p.status === status) &&
            (!building || String(p.building_id) === building) &&
            (!search || p.full_name.toLowerCase().includes(search.toLowerCase()) || p.nim.includes(search)),
    );

    const change = (p: Row, next: string) => router.patch(route('admin.participants.status', p.id), { status: next }, { preserveScroll: true, preserveState: true });

    return (
        <AppLayout breadcrumbs={[{ title: 'Bracket', href: '/admin/bracket' }]}>
            <Head title="Bracket & Eliminasi" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Bracket & eliminasi"
                    description="Perjalanan cast setelah seleksi. Proses otomatis per game ada di halaman masing-masing challenge; ubah manual di sini bila perlu."
                />

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {statuses.map((s) => (
                        <button
                            key={s.value}
                            type="button"
                            onClick={() => setStatus(status === s.value ? '' : s.value)}
                            className={cn('bg-card hover:border-foreground/30 rounded-xl border p-4 text-left transition', status === s.value && 'border-primary ring-primary/30 ring-1')}
                        >
                            <StatusBadge status={s.value} label={s.label} />
                            <p className="mt-2 text-2xl font-semibold tabular-nums">{counts[s.value] ?? 0}</p>
                        </button>
                    ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input className="pl-9" placeholder="Cari nama atau NIM" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <NativeSelect aria-label="Gedung" value={building} onChange={(e) => setBuilding(e.target.value)}>
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
                            <Th>Peserta</Th>
                            <Th>Gedung</Th>
                            <Th>Status</Th>
                            {isAdmin && <Th className="text-right">Ubah manual</Th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <EmptyRow colSpan={4}>Belum ada peserta di bracket. Tetapkan cast dari halaman hasil ujian.</EmptyRow>}
                        {rows.map((p) => (
                            <Tr key={p.id}>
                                <Td>
                                    <Link href={route('admin.participants.show', p.id)} className="flex items-center gap-3">
                                        {p.photo_url ? (
                                            <img src={p.photo_url} alt="" className="size-8 rounded-full border object-cover" loading="lazy" />
                                        ) : (
                                            <span className="bg-muted flex size-8 items-center justify-center rounded-full">
                                                <UserRound className="text-muted-foreground size-4" />
                                            </span>
                                        )}
                                        <span>
                                            <span className="block font-medium hover:underline">{p.full_name}</span>
                                            <span className="text-muted-foreground text-xs tabular-nums">{p.nim}</span>
                                        </span>
                                    </Link>
                                </Td>
                                <Td>{p.building}</Td>
                                <Td>
                                    <StatusBadge status={p.status} label={p.status_label} />
                                </Td>
                                {isAdmin && (
                                    <Td className="text-right whitespace-nowrap">
                                        {actions
                                            .filter((a) => a.status !== p.status)
                                            .map((a) => (
                                                <Button key={a.status} size="sm" variant="ghost" onClick={() => change(p, a.status)}>
                                                    {a.label}
                                                </Button>
                                            ))}
                                    </Td>
                                )}
                            </Tr>
                        ))}
                    </tbody>
                </DataTable>
            </div>
        </AppLayout>
    );
}
