import { useEffect, useState } from 'react';

interface ProgressiveDatasetOptions<T> {
    /** Unique key in sessionStorage */
    storageKey: string;
    /** Signature / version string to validate cache freshness (e.g. total count + updated_at) */
    signature: string;
    /** Initial items rendered on page load (first batch) */
    initialItems: T[];
    /** Total expected items across all batches */
    total: number;
    /** URL to fetch subsequent batches (receives batch_page and batch_size query params) */
    fetchUrl: string;
    /** Number of items to request per background batch */
    batchSize?: number;
    /** Extract unique key per item to deduplicate when merging */
    getKey: (item: T) => number | string;
}

interface StoredCache<T> {
    signature: string;
    complete: boolean;
    items: T[];
}

function readCache<T>(storageKey: string, signature: string): StoredCache<T> | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredCache<T>;
        if (parsed && parsed.signature === signature && Array.isArray(parsed.items)) {
            return parsed;
        }
    } catch {
        // Ignore sessionStorage parse/quota errors
    }
    return null;
}

function writeCache<T>(storageKey: string, data: StoredCache<T>): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
        // Ignore sessionStorage quota errors
    }
}

export function clearProgressiveCache(prefix: string): void {
    if (typeof window === 'undefined') return;
    try {
        for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
            const key = window.sessionStorage.key(i);
            if (key && key.startsWith(prefix)) {
                window.sessionStorage.removeItem(key);
            }
        }
    } catch {
        // Ignore storage access errors
    }
}

function mergeItems<T>(base: T[], incoming: T[], getKey: (item: T) => number | string): T[] {
    const map = new Map<number | string, T>();
    for (const item of base) {
        map.set(getKey(item), item);
    }
    for (const item of incoming) {
        map.set(getKey(item), item);
    }
    return Array.from(map.values());
}

export function useProgressiveDataset<T>({
    storageKey,
    signature,
    initialItems,
    total,
    fetchUrl,
    batchSize = 200,
    getKey,
}: ProgressiveDatasetOptions<T>) {
    const [state, setState] = useState<{ items: T[]; syncing: boolean; complete: boolean }>(() => {
        const cached = readCache<T>(storageKey, signature);
        if (cached && cached.complete && cached.items.length >= total) {
            // Overlay latest initialItems in case first page had fresh fields
            const merged = mergeItems(cached.items, initialItems, getKey);
            return { items: merged, syncing: false, complete: true };
        }
        const isAlreadyComplete = initialItems.length >= total;
        return {
            items: initialItems,
            syncing: !isAlreadyComplete,
            complete: isAlreadyComplete,
        };
    });

    // Keep state in sync when server props (signature / initialItems) update
    useEffect(() => {
        const cached = readCache<T>(storageKey, signature);
        if (cached && cached.complete && cached.items.length >= total) {
            const merged = mergeItems(cached.items, initialItems, getKey);
            writeCache(storageKey, { signature, complete: true, items: merged });
            setState({ items: merged, syncing: false, complete: true });
            return;
        }

        if (initialItems.length >= total) {
            writeCache(storageKey, { signature, complete: true, items: initialItems });
            setState({ items: initialItems, syncing: false, complete: true });
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        const runSync = async () => {
            setState((prev) => ({
                items: mergeItems( initialItems, prev.items.length > initialItems.length ? [] : [], getKey),
                syncing: true,
                complete: false,
            }));

            let accumulated = [...initialItems];
            const totalPages = Math.max(1, Math.ceil(total / batchSize));

            try {
                for (let page = 1; page <= totalPages; page++) {
                    if (cancelled) return;

                    // Yield to main thread before each batch request
                    await new Promise<void>((resolve) => {
                        window.setTimeout(resolve, page === 1 ? 60 : 30);
                    });
                    if (cancelled) return;

                    const url = new URL(fetchUrl, window.location.origin);
                    url.searchParams.set('batch_page', String(page));
                    url.searchParams.set('batch_size', String(batchSize));

                    const res = await fetch(url.toString(), {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        signal: controller.signal,
                    });

                    if (!res.ok) break;

                    const data = (await res.json()) as { rows?: T[]; has_more?: boolean };
                    if (cancelled || !Array.isArray(data.rows)) break;

                    accumulated = page === 1 ? mergeItems(data.rows, initialItems, getKey) : mergeItems(accumulated, data.rows, getKey);

                    const isLast = page >= totalPages || data.has_more === false || accumulated.length >= total;
                    writeCache(storageKey, {
                        signature,
                        complete: isLast,
                        items: accumulated,
                    });

                    setState({
                        items: accumulated,
                        syncing: !isLast,
                        complete: isLast,
                    });

                    if (isLast) break;
                }
            } catch {
                if (!cancelled) {
                    setState((prev) => ({ ...prev, syncing: false }));
                }
            }
        };

        void runSync();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [storageKey, signature, total, fetchUrl, batchSize]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        items: state.items,
        isSyncing: state.syncing,
        isComplete: state.complete,
    };
}
