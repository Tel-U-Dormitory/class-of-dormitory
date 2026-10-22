import { cn } from '@/lib/utils';

/** Tabel sederhana dengan scroll horizontal di layar sempit. */
export function DataTable({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('bg-card overflow-x-auto rounded-xl border', className)}>
            <table className="w-full text-sm">{children}</table>
        </div>
    );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
    return <th className={cn('text-muted-foreground border-b px-4 py-3 text-left text-xs font-medium whitespace-nowrap', className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
    return (
        <td colSpan={colSpan} className={cn('border-b px-4 py-3 align-middle group-last:border-b-0', className)}>
            {children}
        </td>
    );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
    return <tr className={cn('group hover:bg-muted/40 transition-colors', className)}>{children}</tr>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
    return (
        <tr>
            <td colSpan={colSpan} className="text-muted-foreground px-4 py-12 text-center text-sm">
                {children}
            </td>
        </tr>
    );
}
