import { Embers } from '@/components/embers';
import { FlashToaster } from '@/components/flash-toaster';
import { preloadSounds } from '@/lib/sound';
import { Link } from '@inertiajs/react';
import { Maximize, Minimize } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Layar kiosk game panggung: gelap, tanpa navigasi admin. */
export default function ArenaLayout({ children }: { children: React.ReactNode }) {
    const [fullscreen, setFullscreen] = useState(false);

    useEffect(() => {
        preloadSounds();
        const onChange = () => setFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    return (
        <div className="dark relative isolate min-h-svh bg-[#070A0F] px-4 py-6 text-white select-none sm:px-6">
            <Embers className="-z-10 opacity-60" />
            <header className="mb-6 flex items-center justify-between gap-4">
                <span className="w-9" />
                <img src="/images/logo.webp" alt="Clash of Dormitory" className="h-12 drop-shadow-[0_0_12px_rgba(229,9,20,0.6)] sm:h-14" />
                <button
                    type="button"
                    onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
                    className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
                >
                    {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
                </button>
            </header>
            {children}
            <footer className="mt-8 text-center text-xs text-slate-600">
                Mode kiosk panitia ·{' '}
                <Link href={route('admin.challenges.index')} className="underline-offset-4 hover:underline">
                    kembali ke panel
                </Link>
            </footer>
            <FlashToaster />
        </div>
    );
}
