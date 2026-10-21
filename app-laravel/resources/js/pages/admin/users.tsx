import { DataTable, Td, Th, Tr } from '@/components/data-table';
import InputError from '@/components/input-error';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { formatDateTime } from '@/lib/format';
import { type Option } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface UserRow {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
    is_self: boolean;
    created_at: string;
}

export default function Users({ users, roles }: { users: UserRow[]; roles: Option[] }) {
    const [editing, setEditing] = useState<UserRow | 'new' | null>(null);

    return (
        <AppLayout breadcrumbs={[{ title: 'Akun panitia', href: '/admin/panitia' }]}>
            <Head title="Akun Panitia" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Akun panitia"
                    description="Administrator bisa mengubah semua data. Operator hanya memantau, melihat hasil, menjalankan kiosk dan cast reveal."
                    actions={
                        <Button onClick={() => setEditing('new')}>
                            <Plus /> Akun baru
                        </Button>
                    }
                />

                <DataTable>
                    <thead>
                        <tr>
                            <Th>Nama</Th>
                            <Th>Email</Th>
                            <Th>Peran</Th>
                            <Th>Dibuat</Th>
                            <Th />
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <Tr key={u.id}>
                                <Td className="font-medium">
                                    {u.name} {u.is_self && <span className="text-muted-foreground text-xs">(kamu)</span>}
                                </Td>
                                <Td>{u.email}</Td>
                                <Td>{u.role_label}</Td>
                                <Td className="text-muted-foreground">{formatDateTime(u.created_at)}</Td>
                                <Td className="text-right whitespace-nowrap">
                                    <Button size="icon" variant="ghost" aria-label={`Ubah ${u.name}`} onClick={() => setEditing(u)}>
                                        <Pencil />
                                    </Button>
                                    {!u.is_self && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            aria-label={`Hapus ${u.name}`}
                                            onClick={() => confirm(`Hapus akun ${u.email}?`) && router.delete(route('admin.users.destroy', u.id), { preserveScroll: true })}
                                        >
                                            <Trash2 />
                                        </Button>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </DataTable>
            </div>

            {editing && <UserDialog key={editing === 'new' ? 'new' : editing.id} user={editing === 'new' ? null : editing} roles={roles} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

function UserDialog({ user, roles, onClose }: { user: UserRow | null; roles: Option[]; onClose: () => void }) {
    const form = useForm({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? 'operator', password: '' });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (user) form.put(route('admin.users.update', user.id), options);
        else form.post(route('admin.users.store'), options);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{user ? 'Ubah akun' : 'Akun panitia baru'}</DialogTitle>
                        <DialogDescription>Berikan password ke panitia secara langsung; mereka bisa menggantinya di pengaturan akun.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="u-name">Nama</Label>
                        <Input id="u-name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="u-email">Email</Label>
                        <Input id="u-email" type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                        <InputError message={form.errors.email} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="u-role">Peran</Label>
                        <NativeSelect id="u-role" value={form.data.role} onChange={(e) => form.setData('role', e.target.value)}>
                            {roles.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="u-password">{user ? 'Password baru (opsional)' : 'Password'}</Label>
                        <Input id="u-password" type="password" autoComplete="new-password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />
                        <InputError message={form.errors.password} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            Simpan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
