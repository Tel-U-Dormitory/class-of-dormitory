import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { formatDateTime } from '@/lib/format';
import { type Option, type Paginated } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Search, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ParticipantRow {
    id: number;
    full_name: string;
    nim: string;
    email: string | null;
    building: string;
    room_number: string;
    major: string;
    status: string;
    status_label: string;
    photo_url: string | null;
    created_at: string;
}

interface Props {
    participants: Paginated<ParticipantRow>;
    filters: { search?: string; building?: number; status?: string };
    buildings: { id: number; name: string }[];
    statuses: Option[];
}

export default function ParticipantsIndex({ participants, filters, buildings, statuses }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const first = useRef(true);

    const apply = (next: Record<string, string | number | undefined>) => {
        const query = Object.fromEntries(Object.entries({ ...filters, search, ...next }).filter(([, v]) => v !== '' && v != null));
        router.get(route('admin.participants.index'), query, { preserveState: true, replace: true });
    };

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const id = window.setTimeout(() => apply({ search }), 350);
        return () => window.clearTimeout(id);
    }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AppLayout breadcrumbs={[{ title: 'Peserta', href: '/admin/peserta' }]}>
            <Head title="Peserta" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader title="Peserta" description={`${participants.total} peserta terdaftar`} />

                <div className="grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input className="pl-9" placeholder="Cari nama, NIM, email" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <NativeSelect aria-label="Gedung" value={filters.building ?? ''} onChange={(e) => apply({ building: e.target.value })}>
                        <option value="">Semua gedung</option>
                        {buildings.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </NativeSelect>
                    <NativeSelect aria-label="Status" value={filters.status ?? ''} onChange={(e) => apply({ status: e.target.value })}>
                        <option value="">Semua status</option>
                        {statuses.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </NativeSelect>
                </div>

                <DataTable>
                    <thead>
                        <tr>
                            <Th>Peserta</Th>
                            <Th>Gedung</Th>
                            <Th>Prodi</Th>
                            <Th>Status</Th>
                            <Th>Terdaftar</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants.data.length === 0 && <EmptyRow colSpan={5}>Tidak ada peserta yang cocok dengan filter.</EmptyRow>}
                        {participants.data.map((p) => (
                            <Tr key={p.id}>
                                <Td>
                                    <Link href={route('admin.participants.show', p.id)} className="flex items-center gap-3">
                                        {p.photo_url ? (
                                            <img src={p.photo_url} alt="" className="size-9 rounded-full border object-cover" loading="lazy" />
                                        ) : (
                                            <span className="bg-muted flex size-9 items-center justify-center rounded-full">
                                                <UserRound className="text-muted-foreground size-4" />
                                            </span>
                                        )}
                                        <span>
                                            <span className="block font-medium hover:underline">{p.full_name}</span>
                                            <span className="text-muted-foreground text-xs tabular-nums">{p.nim}</span>
                                        </span>
                                    </Link>
                                </Td>
                                <Td className="whitespace-nowrap">
                                    {p.building} <span className="text-muted-foreground">· {p.room_number}</span>
                                </Td>
                                <Td className="text-muted-foreground">{p.major}</Td>
                                <Td>
                                    <StatusBadge status={p.status} label={p.status_label} />
                                </Td>
                                <Td className="text-muted-foreground whitespace-nowrap">{formatDateTime(p.created_at)}</Td>
                            </Tr>
                        ))}
                    </tbody>
                </DataTable>

                {participants.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Halaman">
                        <span className="text-muted-foreground">
                            {participants.from}–{participants.to} dari {participants.total}
                        </span>
                        <div className="flex flex-wrap gap-1">
                            {participants.links.map((link, i) => (
                                <Button key={i} asChild={!!link.url} size="sm" variant={link.active ? 'secondary' : 'ghost'} disabled={!link.url}>
                                    {link.url ? (
                                        <Link href={link.url} preserveState dangerouslySetInnerHTML={{ __html: link.label }} />
                                    ) : (
                                        <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                    )}
                                </Button>
                            ))}
                        </div>
                    </nav>
                )}
            </div>
        </AppLayout>
    );
}
