// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreSellingPoints } from './MestreSellingPoints';
import {
  SELLING_POINT_ICONS,
  SELLING_POINT_ICON_KEYS,
  SELLING_POINT_ICON_LABELS,
  resolveSellingPointIcon,
  type SellingPoint,
} from './sellingPointIcons';
import { Sparkles } from 'lucide-react';

/**
 * Dicionário fechado de ícones de selling_points (spec 099, B4/A7).
 *
 * O dicionário vive em MestreSellingPoints (junto da exibição; o editor o
 * importa de lá) — fonte única: 14 chaves do contrato (§2.2), cada uma com
 * ícone e rótulo, fallback `Sparkles` para chave fora da lista. A exibição
 * continua resolvendo por este dicionário — nenhum mapa local.
 */

describe('dicionário fechado de selling_points', () => {
  it('tem exatamente as 14 chaves do contrato (spec §2.2)', () => {
    expect([...SELLING_POINT_ICON_KEYS]).toEqual([
      'clock',
      'monitor',
      'coins',
      'sparkles',
      'shield',
      'heart',
      'zap',
      'users',
      'trophy',
      'headphones',
      'mic',
      'video',
      'film',
      'book',
    ]);
    expect(SELLING_POINT_ICON_KEYS).toHaveLength(14);
  });

  it('toda chave tem ícone E rótulo (o Select e o teste cruzam os dois)', () => {
    for (const key of SELLING_POINT_ICON_KEYS) {
      expect(SELLING_POINT_ICONS[key], `ícone ausente para ${key}`).toBeDefined();
      expect(SELLING_POINT_ICON_LABELS[key], `rótulo ausente para ${key}`).toBeDefined();
    }
  });

  it('chave fora da lista cai no fallback Sparkles, sem quebrar', () => {
    expect(resolveSellingPointIcon('não-existe')).toBe(Sparkles);
    expect(resolveSellingPointIcon(undefined)).toBe(Sparkles);
    expect(resolveSellingPointIcon(null)).toBe(Sparkles);
  });

  it('resolve chave ignorando caixa (contrato da exibição)', () => {
    expect(resolveSellingPointIcon('CLOCK')).toBe(SELLING_POINT_ICONS.clock);
  });
});

describe('MestreSellingPoints — usa o dicionário do mesmo módulo', () => {
  const point = (icon: string): SellingPoint => ({
    icon,
    title: 'Mesa segura',
    description: 'Ferramentas de segurança na sessão zero.',
  });

  it('renderiza o ícone resolvido pela chave do dicionário', () => {
    render(<MestreSellingPoints sellingPoints={[point('shield')]} />);
    const card = screen.getByText('Mesa segura').closest('.benefit-card');
    expect(card).not.toBeNull();
    expect(card!.querySelector('svg.lucide-shield')).not.toBeNull();
  });

  it('chave desconhecida renderiza o fallback Sparkles', () => {
    render(<MestreSellingPoints sellingPoints={[point('fora-da-lista')]} />);
    const card = screen.getByText('Mesa segura').closest('.benefit-card');
    expect(card!.querySelector('svg.lucide-sparkles')).not.toBeNull();
  });

  it('não renderiza sem array ou com array vazio', () => {
    const { container, rerender } = render(<MestreSellingPoints sellingPoints={undefined} />);
    expect(container.innerHTML).toBe('');
    rerender(<MestreSellingPoints sellingPoints={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
