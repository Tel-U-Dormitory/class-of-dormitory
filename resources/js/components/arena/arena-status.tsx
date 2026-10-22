import { Lock, OctagonX } from 'lucide-react';

export function ArenaStatusNotice({ status }: { status: 'locked' | 'ended' }) {
    const locked = status === 'locked';
    const Icon = locked ? Lock : OctagonX;

    return (
        <div className="rounded-xl border border-red-600/40 bg-black/50 p-8 text-center">
            <Icon className="mx-auto size-10 text-amber-300" />
            <h2 className="font-display mt-4 text-lg font-bold tracking-wide text-amber-300 uppercase">{locked ? 'Game belum dimulai' : 'Game telah ditutup'}</h2>
            <p className="mt-2 text-sm text-slate-400">
                {locked ? 'Menunggu panitia membuka game dari panel kontrol. Halaman ini terbuka otomatis.' : 'Sesi pengerjaan game ini sudah berakhir.'}
            </p>
        </div>
    );
}
