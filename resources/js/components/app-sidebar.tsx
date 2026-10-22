import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ClipboardList, ExternalLink, GitFork, Gamepad2, LayoutGrid, ShieldCheck, Users } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    { title: 'Dashboard', url: '/admin', icon: LayoutGrid, exact: true },
    { title: 'Ujian & Bank Soal', url: '/admin/ujian', icon: ClipboardList, adminOnly: true, activeFor: ['/admin/pilar'] },
    { title: 'Peserta', url: '/admin/peserta', icon: Users },
    { title: 'Challenge & Game', url: '/admin/challenge', icon: Gamepad2, adminOnly: true },
    { title: 'Bracket', url: '/admin/bracket', icon: GitFork },
    { title: 'Akun panitia', url: '/admin/panitia', icon: ShieldCheck, adminOnly: true },
];

const footerNavItems: NavItem[] = [{ title: 'Buka situs peserta', url: '/', icon: ExternalLink }];

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
    const items = mainNavItems.filter((item) => !item.adminOnly || auth.user?.role === 'admin');

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/admin" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={items} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
