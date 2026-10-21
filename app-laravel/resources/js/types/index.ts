import { LucideIcon } from 'lucide-react';

export type Pillar = 'memory' | 'spatial' | 'numeric' | 'logic';

export interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'operator';
    avatar?: string;
    [key: string]: unknown;
}

export interface AuthParticipant {
    id: number;
    full_name: string;
    nim: string;
}

export interface Auth {
    user: User | null;
    participant: AuthParticipant | null;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    adminOnly?: boolean;
    /** Prefix URL tambahan yang membuat item ini aktif. */
    activeFor?: string[];
    /** Hanya aktif jika URL sama persis. */
    exact?: boolean;
}

export interface SharedData {
    name: string;
    auth: Auth;
    flash: { success: string | null; error: string | null };
    [key: string]: unknown;
}

export interface Option {
    value: string;
    label: string;
}

export interface Paginated<T> {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
}
