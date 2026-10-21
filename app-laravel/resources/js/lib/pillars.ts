import { type Pillar } from '@/types';
import { Brain, Calculator, Box, Network, type LucideIcon } from 'lucide-react';

export const pillarMeta: Record<Pillar, { icon: LucideIcon; text: string; bg: string; border: string; ring: string }> = {
    memory: { icon: Brain, text: 'text-pillar-memory', bg: 'bg-pillar-memory', border: 'border-pillar-memory', ring: 'ring-pillar-memory' },
    spatial: { icon: Box, text: 'text-pillar-spatial', bg: 'bg-pillar-spatial', border: 'border-pillar-spatial', ring: 'ring-pillar-spatial' },
    numeric: { icon: Calculator, text: 'text-pillar-numeric', bg: 'bg-pillar-numeric', border: 'border-pillar-numeric', ring: 'ring-pillar-numeric' },
    logic: { icon: Network, text: 'text-pillar-logic', bg: 'bg-pillar-logic', border: 'border-pillar-logic', ring: 'ring-pillar-logic' },
};
