import { PageSkeleton } from '@/components/page-skeleton';
import { router } from '@inertiajs/react';
import { type ReactNode, useEffect, useState } from 'react';

/** Give immediate feedback while a full GET visit waits for its response. */
export function NavigationContent({ children }: { children: ReactNode }) {
    const [pendingUrl, setPendingUrl] = useState<string | null>(null);

    useEffect(() => {
        const removeStart = router.on('start', ({ detail: { visit } }) => {
            if (visit.method !== 'get' || visit.prefetch || visit.async || visit.only.length > 0) return;
            const target = visit.url;
            if (target.pathname + target.search !== window.location.pathname + window.location.search) {
                setPendingUrl(target.href);
            }
        });
        const removeFinish = router.on('finish', ({ detail: { visit } }) => {
            setPendingUrl((current) => (current === visit.url.href ? null : current));
        });
        return () => {
            removeStart();
            removeFinish();
        };
    }, []);

    return (
        <>
            {pendingUrl && <PageSkeleton />}
            <div hidden={pendingUrl !== null} className={pendingUrl ? 'hidden' : 'contents'}>
                {children}
            </div>
        </>
    );
}
