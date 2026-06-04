import { Sparkles, Crown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TableBadgeSource {
  is_covil?: boolean;
  is_ddal?: boolean;
}

export interface TableBadge {
  id: string;
  label: string;
  icon: LucideIcon;
  color: 'amber' | 'purple' | 'blue' | 'green';
  priority: number;
}

/**
 * Sistema extensível de badges/certificações para mesas
 * Prioridade: maior = mais importante (aparece primeiro)
 */
export function getTableBadges(table: TableBadgeSource): TableBadge[] {
  const badges: TableBadge[] = [];

  // Covil do Lich (prioridade máxima - curadoria premium)
  if (table.is_covil) {
    badges.push({
      id: 'covil',
      label: 'Covil do Lich',
      icon: Crown,
      color: 'purple',
      priority: 3,
    });
  }

  // DDAL (prioridade alta - certificação oficial)
  if (table.is_ddal) {
    badges.push({
      id: 'ddal',
      label: 'DDAL',
      icon: Sparkles,
      color: 'amber',
      priority: 2,
    });
  }

  // Ordenar por prioridade (maior primeiro)
  return badges.sort((a, b) => b.priority - a.priority);
}

/**
 * Retorna classes CSS para um badge baseado na cor
 */
export function getBadgeClasses(color: TableBadge['color']): string {
  const colorMap: Record<TableBadge['color'], string> = {
    amber: 'bg-amber-500/20 border-amber-300/40 text-amber-100',
    purple: 'bg-purple-500/20 border-purple-300/40 text-purple-100',
    blue: 'bg-blue-500/20 border-blue-300/40 text-blue-100',
    green: 'bg-green-500/20 border-green-300/40 text-green-100',
  };

  return colorMap[color];
}
