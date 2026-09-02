import { describe, expect, it } from 'vitest';
import { RECOMMENDED_GAIN } from './profileEditorDomain';
import {
  PROFILE_PARTS,
  PROFILE_PART_RECOMMENDED_FIELDS,
  computeProfilePendingCounts,
  computeProfileProgress,
  getProfilePartLabel,
  isProfileFieldFilled,
  profilePartDomId,
} from './profileEditorParts';

/**
 * Casca do editor de perfil (spec 099, fase G — G3/G4).
 *
 * O cruzamento com `RECOMMENDED_GAIN` é o que impede os dois registros de
 * divergirem em silêncio: um campo recomendado que não more em parte alguma
 * nunca apareceria na contagem da lateral, e o mestre teria uma pendência
 * invisível — exatamente o defeito que a A12 existe para evitar.
 */

describe('PROFILE_PARTS — as 5 partes de spec §13.5', () => {
  it('tem as 5 partes na ordem da spec', () => {
    expect(PROFILE_PARTS.map((p) => p.id)).toEqual([
      'quem',
      'como',
      'mesa',
      'prova',
      'onde',
    ]);
  });

  it('todo rótulo é conversacional e toda parte declara a pergunta do jogador', () => {
    for (const part of PROFILE_PARTS) {
      expect(part.label.trim().length).toBeGreaterThan(0);
      expect(part.question.trim().length).toBeGreaterThan(0);
    }
  });

  it('o id do DOM é estável e único por parte (âncora do scrollIntoView)', () => {
    const ids = PROFILE_PARTS.map((p) => profilePartDomId(p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getProfilePartLabel devolve o rótulo do registro', () => {
    expect(getProfilePartLabel('quem')).toBe('Quem é você');
  });
});

describe('cruzamento parte × RECOMMENDED_GAIN (A12/A14)', () => {
  it('todo campo alocado a uma parte tem frase de ganho no registro', () => {
    for (const part of PROFILE_PARTS) {
      for (const field of PROFILE_PART_RECOMMENDED_FIELDS[part.id]) {
        expect(RECOMMENDED_GAIN).toHaveProperty(field);
      }
    }
  });

  it('vice-versa: todo recomendado mora em exatamente uma parte', () => {
    const alocados = PROFILE_PARTS.flatMap(
      (part) => PROFILE_PART_RECOMMENDED_FIELDS[part.id],
    );
    // Sem duplicata: campo em duas partes seria contado duas vezes.
    expect(new Set(alocados).size).toBe(alocados.length);
    expect(new Set(alocados)).toEqual(new Set(Object.keys(RECOMMENDED_GAIN)));
  });
});

describe('isProfileFieldFilled', () => {
  it('trata 0 anos de experiência como PREENCHIDO', () => {
    // "mestro há menos de um ano" é resposta, não ausência de resposta. Um
    // teste de verdade (`!value`) contaria 0 como vazio e cobraria do mestre
    // um campo que ele já respondeu.
    expect(isProfileFieldFilled('experienceYears', { experience_years: 0 }, 0)).toBe(true);
    expect(isProfileFieldFilled('experienceYears', { experience_years: null }, 0)).toBe(false);
  });

  it('texto só conta preenchido quando não é espaço em branco', () => {
    expect(isProfileFieldFilled('tagline', { tagline: '   ' }, 0)).toBe(false);
    expect(isProfileFieldFilled('tagline', { tagline: 'Épico' }, 0)).toBe(true);
  });

  it('lista vazia não conta, e payload não-array não quebra', () => {
    expect(isProfileFieldFilled('specialties', { specialties: [] }, 0)).toBe(false);
    expect(isProfileFieldFilled('specialties', { specialties: ['horror'] }, 0)).toBe(true);
    // Dado de API é `unknown` até normalizar (AGENTS.md): valor errado devolve
    // false em vez de estourar em `.length`.
    expect(
      isProfileFieldFilled('specialties', { specialties: 'horror' } as never, 0),
    ).toBe(false);
  });

  it('links vêm da coleção própria, não do gm', () => {
    expect(isProfileFieldFilled('links', {}, 0)).toBe(false);
    expect(isProfileFieldFilled('links', {}, 2)).toBe(true);
  });

  it('gm nulo (mestre novo) não quebra a contagem', () => {
    expect(isProfileFieldFilled('tagline', null, 0)).toBe(false);
  });
});

describe('computeProfilePendingCounts (A12)', () => {
  it('conta os recomendados por preencher, por parte', () => {
    const counts = computeProfilePendingCounts(null, 0);
    expect(counts.quem).toBe(2); // tagline, experienceYears
    // `languages` conta em "como" porque é lá que o campo aparece — contá-lo
    // em "mesa" punha o badge numa seção sem o controle (achado do Codex).
    expect(counts.como).toBe(4); // bioLong, specialties, sellingPoints, languages
    expect(counts.mesa).toBe(0); // sistemas e grupo fechado são opcionais (§8)
    // "Prova" não tem recomendado editável: avaliações não se editam aqui (D3)
    // e os selos são opcionais (§8). Zero é o valor correto, não lacuna.
    expect(counts.prova).toBe(0);
    expect(counts.onde).toBe(1); // links
  });

  it('a contagem cai ao preencher', () => {
    const antes = computeProfilePendingCounts({ tagline: null }, 0);
    const depois = computeProfilePendingCounts({ tagline: 'Épico' }, 0);
    expect(depois.quem).toBe(antes.quem - 1);
  });

  it('devolve uma entrada por parte, sempre', () => {
    const counts = computeProfilePendingCounts(null, 0);
    expect(Object.keys(counts).sort()).toEqual(PROFILE_PARTS.map((p) => p.id).sort());
  });
});

describe('computeProfileProgress', () => {
  it('vai de 0 a 1 conforme os recomendados são preenchidos', () => {
    expect(computeProfileProgress(null, 0)).toBe(0);
    expect(
      computeProfileProgress(
        {
          tagline: 'Épico',
          experience_years: 3,
          bio_long: 'Mestro há anos.',
          specialties: ['horror'],
          selling_points: [{ icon: 'dice', title: 't', description: 'd' }] as never,
          languages: ['pt-BR'],
        },
        1,
      ),
    ).toBe(1);
  });

  it('meio caminho é fração, não arredondamento', () => {
    const progress = computeProfileProgress({ tagline: 'Épico' }, 0);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });
});
