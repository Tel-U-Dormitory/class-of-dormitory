import AppLogoIcon from '@/components/app-logo-icon';
import { Embers } from '@/components/embers';
import { FlashToaster } from '@/components/flash-toaster';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';

/**
 * Layout area publik & peserta. Selalu bertema gelap (navy) sesuai identitas visual CoD.
 */
export default function PublicLayout({ children, className, wide = false }: { children: React.ReactNode; className?: string; wide?: boolean }) {
    const { auth } = usePage<SharedData>().props;

    return (
        <div className="dark bg-background text-foreground relative isolate flex min-h-svh flex-col">
            <Embers className="-z-10 opacity-50" count={45} />
            <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
                <div className={cn('mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6', wide ? 'max-w-7xl' : 'max-w-6xl')}>
                    <Link href={route('home')} className="flex items-center gap-2.5">
                        <AppLogoIcon className="text-primary size-7" />
                        <span className="font-display text-sm font-bold sm:text-base">Clash of Dormitory</span>
                    </Link>

                    <nav className="flex items-center gap-2">
                        {auth.participant ? (
                            <>
                                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                                    <Link href={route('participant.dashboard')}>{auth.participant.full_name.split(' ')[0]}</Link>
                                </Button>
                                <Button asChild size="sm">
                                    <Link href={route('exam.lobby')}>Ruang Ujian</Link>
                                </Button>
                                <Button asChild variant="ghost" size="icon" aria-label="Keluar">
                                    <Link href={route('participant.logout')} method="post" as="button">
                                        <LogOut className="size-4" />
                                    </Link>
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href={route('participant.login')}>Masuk</Link>
                                </Button>
                                <Button asChild size="sm">
                                    <Link href={route('participant.register')}>Daftar</Link>
                                </Button>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            <main className={cn('flex-1', className)}>{children}</main>

            <footer className="border-border/60 border-t">
                <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p>© {new Date().getFullYear()} Clash of Dormitory · Season 3</p>
                    <p>
                        Panitia?{' '}
                        <Link href={route('login')} className="text-foreground underline-offset-4 hover:underline">
                            Masuk panel
                        </Link>
                    </p>
                </div>
            </footer>
            <FlashToaster />
        </div>
    );
}
