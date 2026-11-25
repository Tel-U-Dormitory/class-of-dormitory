import { DataTable, EmptyRow, Td, Th, Tr } from '@/components/data-table';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProgressiveDataset } from '@/hooks/use-progressive-dataset';
import AppLayout from '@/layouts/app-layout';
import { formatDateTime } from '@/lib/format';
import { type Option, type Paginated } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { LoaderCircle, Plus, Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ParticipantRow {
    id: number;
    building_id?: number;
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
    datasetSignature?: string;
    datasetTotal?: number;
    filters: { search?: string; building?: number; status?: string };
    buildings: { id: number; name: string }[];
    statuses: Option[];
}

const PER_PAGE = 25;

export default function ParticipantsIndex({ participants, datasetSignature, datasetTotal, filters, buildings, statuses }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [building, setBuilding] = useState<string>(filters.building ? String(filters.building) : '');
    const [status, setStatus] = useState<string>(filters.status ?? '');
    const [page, setPage] = useState<number>(participants.current_page ?? 1);

    const totalDatasetCount = datasetTotal ?? participants.total;
    const signature = datasetSignature ?? `${totalDatasetCount}:${participants.data[0]?.id ?? 0}`;

    const { items: allParticipants, isSyncing } = useProgressiveDataset<ParticipantRow>({
        storageKey: 'cod_admin_participants_v1',
        signature,
        initialItems: participants.data,
        total: totalDatasetCount,
        fetchUrl: route('admin.participants.index'),
        batchSize: 200,
        getKey: (item) => item.id,
    });

    const buildingNameById = useMemo(
        () => new Map(buildings.map((b) => [String(b.id), b.name])),
        [buildings],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const targetBuildingName = building ? buildingNameById.get(building) : null;

        return allParticipants.filter((p) => {
            if (building) {
                const matchId = p.building_id !== undefined && String(p.building_id) === building;
                const matchName = targetBuildingName ? p.building === targetBuildingName : false;
                if (!matchId && !matchName) return false;
            }
            if (status && p.status !== status) return false;
            if (q) {
                const inName = p.full_name.toLowerCase().includes(q);
                const inNim = p.nim.toLowerCase().includes(q);
                const inEmail = p.email ? p.email.toLowerCase().includes(q) : false;
                if (!inName && !inNim && !inEmail) return false;
            }
            return true;
        });
    }, [allParticipants, search, building, status, buildingNameById]);

    const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const safePage = Math.min(Math.max(1, page), lastPage);
    const visibleRows = useMemo(
        () => filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
        [filtered, safePage],
    );

    const from = filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
    const to = Math.min(safePage * PER_PAGE, filtered.length);

    return (
        <AppLayout breadcrumbs={[{ title: 'Peserta', href: '/admin/peserta' }]}>
            <Head title="Peserta" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Peserta"
                    description={
                        <span className="inline-flex items-center gap-2">
                            <span>{totalDatasetCount} peserta terdaftar</span>
                            {isSyncing && (
                                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                                    <LoaderCircle className="size-3 animate-spin" /> Menyinkronkan data ({allParticipants.length}/{totalDatasetCount})
                                </span>
                            )}
                        </span>
                    }
                    actions={
                        <Button asChild>
                            <Link href={route('admin.participants.create')}>
                                <Plus /> Tambah peserta
                            </Link>
                        </Button>
                    }
                />

                <div className="grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
                    <div className="relative">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            className="pl-9"
                            placeholder="Cari nama, NIM, email"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <NativeSelect
                        aria-label="Gedung"
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
                    <NativeSelect
                        aria-label="Status"
                        value={status}
                        onChange={(e) => {
                            setStatus(e.target.value);
                            setPage(1);
                        }}
                    >
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
                        {visibleRows.length === 0 && <EmptyRow colSpan={5}>Tidak ada peserta yang cocok dengan filter.</EmptyRow>}
                        {visibleRows.map((p) => (
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

                {lastPage > 1 && (
                    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Halaman">
                        <span className="text-muted-foreground">
                            {from}–{to} dari {filtered.length}
                        </span>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={safePage <= 1}
                                onClick={() => setPage((curr) => Math.max(1, curr - 1))}
                            >
                                Sebelumnya
                            </Button>
                            <span className="flex items-center px-2 text-xs tabular-nums">
                                Halaman {safePage} dari {lastPage}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={safePage >= lastPage}
                                onClick={() => setPage((curr) => Math.min(lastPage, curr + 1))}
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </nav>
                )}
            </div>
        </AppLayout>
    );
}
