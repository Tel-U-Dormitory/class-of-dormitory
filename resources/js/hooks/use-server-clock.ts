import { useEffect, useRef, useState } from 'react';

/**
 * Jam yang disinkronkan dengan server: offset dihitung dari `serverNow` agar hitung mundur
 * tidak bergantung pada jam perangkat peserta.
 */
export function useServerClock(serverNow: number, tickMs = 250): number {
    const offset = useRef(serverNow - Date.now());
    const [now, setNow] = useState(() => Date.now() + offset.current);

    useEffect(() => {
        offset.current = serverNow - Date.now();
        setNow(Date.now() + offset.current);
    }, [serverNow]);

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now() + offset.current), tickMs);
        return () => window.clearInterval(id);
    }, [tickMs]);

    return now;
}
