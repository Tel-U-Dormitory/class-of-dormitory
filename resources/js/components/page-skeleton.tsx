import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton() {
    return (
        <div role="status" aria-label="Memuat data halaman" className="space-y-4 p-4 md:p-6">
            <span className="sr-only">Memuat data halaman…</span>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
            <Skeleton className="h-12 w-full" />
            {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
            ))}
        </div>
    );
}
