import {
  Clock,
  Monitor,
  Coins,
  Sparkles,
  Shield,
  Heart,
  Zap,
  Users,
  Trophy,
  Headphones,
  Mic,
  Video,
  Film,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

/**
 * Dicionário fechado de ícones de `selling_points` (spec 099 §2.2).
 *
 * Fonte única entre a exibição (`MestreSellingPoints`) e o editor
 * (`SellingPointsEditor` em `editor/GmProfileFields.tsx`): o campo é SELEÇÃO
 * entre estes 14 valores, nunca texto livre — chave fora da lista não quebra
 * a página (cai em `Sparkles` via `resolveSellingPointIcon`), mas o backend
 * descarta em silêncio o que não bate e o formulário não pode deixar chegar
 * lá (A7/B4).
 *
 * Mora em módulo próprio (e não dentro de `MestreSellingPoints`) por causa do
 * lint `react-refresh/only-export-components`: arquivo que exporta componente
 * não pode exportar constantes — e este dicionário é importado por exibição E
 * editor, então um `.ts` sem componente é o único lugar sem cópia e sem
 * violação.
 */

export interface SellingPoint {
  icon: string;
  title: string;
  description: string;
  highlight?: string;
}

export const SELLING_POINT_ICONS: Record<string, LucideIcon> = {
  clock: Clock,
  monitor: Monitor,
  coins: Coins,
  sparkles: Sparkles,
  shield: Shield,
  heart: Heart,
  zap: Zap,
  users: Users,
  trophy: Trophy,
  headphones: Headphones,
  mic: Mic,
  video: Video,
  film: Film,
  book: BookOpen,
};

/** As 14 chaves na ordem do dicionário — fonte das opções do `Select` do editor. */
export const SELLING_POINT_ICON_KEYS: readonly string[] = Object.keys(SELLING_POINT_ICONS);

/**
 * Rótulo humano por chave, para o `Select` do editor (o jogador lê o rótulo,
 * o valor gravado é a chave). Mesma fonte do dicionário acima — adicionar
 * ícone novo exige rótulo aqui (o teste do módulo cruza os dois).
 */
export const SELLING_POINT_ICON_LABELS: Record<string, string> = {
  clock: 'Relógio',
  monitor: 'Tela',
  coins: 'Moedas',
  sparkles: 'Brilho',
  shield: 'Escudo',
  heart: 'Coração',
  zap: 'Raio',
  users: 'Pessoas',
  trophy: 'Troféu',
  headphones: 'Fones de ouvido',
  mic: 'Microfone',
  video: 'Vídeo',
  film: 'Filme',
  book: 'Livro',
};

/**
 * Ícone para uma chave, com o fallback `Sparkles` do contrato original
 * (spec §2.2: chave fora da lista cai em `Sparkles` sem aviso).
 */
export function resolveSellingPointIcon(icon: string | null | undefined): LucideIcon {
  return (icon ? SELLING_POINT_ICONS[icon.toLowerCase()] : undefined) ?? Sparkles;
}
