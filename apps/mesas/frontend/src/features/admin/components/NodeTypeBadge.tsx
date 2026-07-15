import { Package, BookOpen, Layers } from 'lucide-react';

const BADGE_META = {
  system:    { Icon: Package,   label: 'Sistema',    color: 'text-blue-400 bg-blue-500/10' },
  edition:   { Icon: BookOpen,  label: 'Edição',     color: 'text-purple-400 bg-purple-500/10' },
  variant:   { Icon: Layers,    label: 'Variante',   color: 'text-amber-400 bg-amber-500/10' },
} as const;

export function NodeTypeBadge({ type }: { type: keyof typeof BADGE_META }) {
  const meta = BADGE_META[type];
  if (!meta) return null;
  const { Icon, color } = meta;
  return (
    <span className={`inline-flex items-center justify-center p-1 rounded ${color}`} title={meta.label}>
      <Icon size={12} />
    </span>
  );
}
