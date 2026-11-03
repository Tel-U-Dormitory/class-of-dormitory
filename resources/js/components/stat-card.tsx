import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

export function StatCard({ label, value, hint, icon: Icon, className }: { label: string; value: React.ReactNode; hint?: string; icon?: LucideIcon; className?: string }) {
    return (
        <Card className={cn('gap-0 py-0', className)}>
            <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                    {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
                </div>
                {Icon && (
                    <div className="bg-primary/10 text-primary rounded-md p-2">
                        <Icon className="size-5" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
