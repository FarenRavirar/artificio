// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreProfilePreview } from './MestreProfilePreview';
import { buildMestrePreviewData } from './profilePreviewMapping';
import type { MestrePreviewSource } from './profilePreviewMapping';

/**
 * Prévia do perfil público nos editores (spec 099 B10/D5/D8).
 *
 * Critério A9: o teste precisa FALHAR se o defeito voltar — a prévia deve
 * renderizar o valor ATUAL dos campos do editor (nada de dado fake/replica).
 * Os casos abaixo passam pelo buildMestrePreviewData e afirmam o texto real
 * dentro do hero; reintroduzir um valor fixo no mapeamento quebra o primeiro
 * caso. O hero é o componente público REAL (não mockado): o scrim fixo do
 * banner (D8) é o `.hero-overlay` que ele já renderiza — a prévia reusa, não
 * replica.
 */

const baseSource: MestrePreviewSource = {
  id: 'g1',
  slug: 'mestre-corvo',
  nickname: 'Mestre Corvo',
  bio_long: 'Narro desde 2015.',
  tagline: 'Aventuras épicas toda quinta',
  avatar_url: null,
  banner_url: null,
  languages: ['pt-BR'],
  specialties: ['fantasia'],
  badges: [],
  experience_years: 14,
  covil_verified: true,
};

describe('buildMestrePreviewData — mapeamento do editor para a prévia', () => {
  it('carrega o texto REAL do editor (tagline/bio atuais viram conteúdo do hero)', () => {
    const preview = buildMestrePreviewData(baseSource, 'Conta Fallback');
    expect(preview.tagline).toBe('Aventuras épicas toda quinta');
    expect(preview.bio_long).toBe('Narro desde 2015.');
  });

  it('display_name espelha o COALESCE do GET público: nickname → nome da conta → slug', () => {
    expect(buildMestrePreviewData(baseSource, 'Conta Fallback').display_name).toBe(
      'Mestre Corvo',
    );
    expect(
      buildMestrePreviewData({ ...baseSource, nickname: null }, 'Conta Fallback').display_name,
    ).toBe('Conta Fallback');
    expect(
      buildMestrePreviewData({ ...baseSource, nickname: null }, null).display_name,
    ).toBe('mestre-corvo');
  });

  it('campo ausente no editor vira fallback neutro, nunca valor inventado', () => {
    const preview = buildMestrePreviewData(baseSource);
    // Sempre 0: o contador do editor conta TODAS as mesas, o publico so as
    // ativas — a previa omite em vez de rotular rascunho como ativa (achado
    // Codex P2, PR #300).
    expect(preview.tables_count).toBe(0);
    expect(preview.reviews_count).toBe(0);
    expect(preview.avg_rating).toBeNull();
    expect(preview.tables).toEqual([]);
    expect(preview.covil_verified).toBe(true); // valor REAL do editor, preservado
  });

  it('selling_points não-array (achado A1: `{}` do JSONB) vira [] via normalizador', () => {
    const preview = buildMestrePreviewData(
      { ...baseSource, selling_points: {} } as MestrePreviewSource,
    );
    expect(preview.selling_points).toEqual([]);
  });
});

describe('MestreProfilePreview — prévia renderiza o hero real com dados reais', () => {
  it('o texto atual digitado no editor aparece na prévia', () => {
    render(<MestreProfilePreview profile={buildMestrePreviewData(baseSource)} />);
    expect(screen.getByText('Aventuras épicas toda quinta')).toBeInTheDocument();
    expect(screen.getByText('Mestre Corvo')).toBeInTheDocument();
  });

  it('renderiza o véu (scrim) fixo do hero real — D8 é prévia, não controle', () => {
    const { container } = render(
      <MestreProfilePreview profile={buildMestrePreviewData(baseSource)} />,
    );
    // O hero público sempre monta o overlay do scrim; com banner, o CSS
    // escurece. A prévia consome o componente real — se alguém remover o
    // overlay da prévia (réplica sem véu), este teste falha.
    expect(container.querySelector('.hero-overlay')).not.toBeNull();
    expect(container.querySelector('.hero-section')).not.toBeNull();
  });

  it('sem tabelas mapeadas o CTA "Ver mesas disponíveis" não aparece (hero só)', () => {
    render(<MestreProfilePreview profile={buildMestrePreviewData(baseSource)} />);
    expect(screen.queryByText('Ver mesas disponíveis')).not.toBeInTheDocument();
    expect(screen.getByText('Entrar em contato')).toBeInTheDocument();
  });

  it('dados reais do editor aparecem no trust row (experiência autodeclarada)', () => {
    render(<MestreProfilePreview profile={buildMestrePreviewData(baseSource)} />);
    expect(screen.getByText('Declara 14+ anos de experiência')).toBeInTheDocument();
    expect(screen.getByText('Verificado no Covil')).toBeInTheDocument();
  });
});
