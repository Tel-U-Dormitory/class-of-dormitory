import { cn } from '@/lib/utils';
import { type Entrant } from './types';

export function EntrantPicker({
    entrants,
    value,
    onChange,
    teamMode,
    className,
}: {
    entrants: Entrant[];
    value: number | null;
    onChange: (id: number | null) => void;
    teamMode: boolean;
    className?: string;
}) {
    const selected = entrants.find((e) => e.id === value);

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <label htmlFor="entrant" className="text-xs font-semibold tracking-wider text-amber-300 uppercase">
                {teamMode ? 'Pilih kelompok' : 'Pilih nama peserta'}
            </label>
            <select
                id="entrant"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
                className="h-12 w-full rounded-md border border-red-600/40 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
            >
                <option value="">{entrants.length ? (teamMode ? '— Pilih kelompok —' : '— Cari nama / NIM —') : 'Belum ada peserta di roster'}</option>
                {entrants.map((e) => (
                    <option key={e.id} value={e.id}>
                        {e.label} — {e.detail}
                    </option>
                ))}
            </select>
            {selected && (
                <div className="rounded-md border border-white/10 bg-slate-950 p-2.5">
                    <p className="text-sm font-semibold text-white">{selected.label}</p>
                    <p className="text-xs text-amber-300">{selected.detail}</p>
                </div>
            )}
        </div>
    );
}
