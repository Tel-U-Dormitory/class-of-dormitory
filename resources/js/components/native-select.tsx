import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';

/** Select native bergaya shadcn: ringan, bisa dipakai di form dan aksesibel di mobile. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
    return (
        <div className="relative">
            <select
                className={cn(
                    'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full appearance-none rounded-md border px-3 pr-9 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50 md:text-sm',
                    className,
                )}
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
        </div>
    );
}
