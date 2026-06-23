import type { ReactNode } from 'react';

interface StatCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly valueClassName?: string;
}

export function StatCard({ label, value, valueClassName = 'text-white text-lg font-bold' }: StatCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
      <p className="text-white/40 text-xs">{label}</p>
      <p className={valueClassName}>{value}</p>
    </div>
  );
}
