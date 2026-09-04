// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RECOMMENDED_GAIN } from './profileEditorDomain';
import {
  TaglineField,
  ProfileTagsSection,
  SellingPointsEditor,
  BioLongField,
  ExperienceYearsField,
} from './GmProfileFields';
import { LinksManager } from '../../LinksManager';

/**
 * Cruzamento recomendado × registro (spec 099, B6) — mesmo padrão do A11 do
 * editor de mesa (editorValidation.test.ts + data-ob do EditorField): todo
 * campo com `data-ob="recommended"` tem chave no `RECOMMENDED_GAIN`, toda
 * chave do registro tem campo renderizado, e os opcionais não têm frase.
 *
 * Renderiza os SETE campos recomendados do editor de perfil juntos —
 * incluindo bio/experiência (extraídos da TabMestre, B6) e links
 * (LinksManager, usado em ProfileEditPage e PainelMestrePage) — para o
 * cruzamento valer sobre o editor inteiro, não por componente.
 */

const { updateGm } = vi.hoisted(() => ({ updateGm: vi.fn() }));

vi.mock('../../../contexts/useProfileContext', () => ({
  useProfileContext: () => ({ updateGm }),
}));

vi.mock('../../../hooks/useSystemsCatalog', () => ({
  useSystemsCatalog: () => ({
    tree: [],
    loading: false,
    error: null,
    flat: [],
    forceRefresh: async () => undefined,
  }),
}));

vi.mock('@artificio/content-editor', () => ({
  ContentEditor: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />,
}));

vi.mock('../../../hooks/useLinks', () => ({
  useLinks: () => ({
    links: [],
    loading: false,
    error: null,
    addLink: async () => ({ ok: true as const }),
    removeLink: async () => true,
    reorderLinks: async () => true,
    refresh: async () => {},
  }),
}));

// Mock parcial: preserva Field/Button/Select/TextInput/Textarea reais do
// pacote e substitui só o useConfirm — sem ele o LinksManager exigiria um
// <ConfirmProvider> ancestral no harness.
vi.mock('@artificio/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificio/ui')>();
  return {
    ...actual,
    useConfirm: () => ({ confirm: async () => true }),
  };
});

/** Renderiza os 7 campos recomendados do editor de perfil. */
function renderAllRecommendedFields() {
  return render(
    <>
      <TaglineField value="" />
      <ProfileTagsSection specialties={[]} languages={[]} badges={[]} />
      <SellingPointsEditor value={[]} />
      <BioLongField value="" />
      <ExperienceYearsField value={null} />
      <LinksManager />
    </>,
  );
}

function recommendedFields(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-ob="recommended"]'))
    .map((el) => el.getAttribute('data-field'))
    .filter((field): field is string => field !== null);
}

describe('RECOMMENDED_GAIN × data-ob (B6) — cruzamento do editor de perfil inteiro', () => {
  it('todo campo com data-ob="recommended" tem data-field com chave no registro', () => {
    const { container } = renderAllRecommendedFields();
    const fields = recommendedFields(container);

    // São exatamente os 7 recomendados de spec §8.
    expect(fields).toHaveLength(7);
    for (const field of fields) {
      expect(RECOMMENDED_GAIN).toHaveProperty(field);
    }
  });

  it('vice-versa: nenhuma chave do registro sem campo renderizado', () => {
    const { container } = renderAllRecommendedFields();
    expect(new Set(recommendedFields(container))).toEqual(new Set(Object.keys(RECOMMENDED_GAIN)));
  });

  it('cada campo recomendado renderiza a frase do ganho do registro', () => {
    renderAllRecommendedFields();
    for (const phrase of Object.values(RECOMMENDED_GAIN)) {
      expect(screen.getByText(`Recomendado — ${phrase}.`)).toBeTruthy();
    }
  });

  it('os opcionais não têm chave no registro (sem frase de ganho)', () => {
    const optionals = [
      'badges',
      'closed_group_enabled',
      'closed_group',
      'promo_badge_text',
      'preferred_vtt_platforms',
      'contact_methods',
      'banner_url',
    ];
    for (const field of optionals) {
      expect(RECOMMENDED_GAIN).not.toHaveProperty(field);
    }
  });
});
