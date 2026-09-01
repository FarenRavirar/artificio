import { describe, expect, it } from 'vitest';
import { profileBioExtractionResultSchema, filterCandidatesByEvidence } from '../llmAssist.js';

describe('profileBioExtractionResultSchema — spec 099 B11', () => {
  it('aceita somente os quatro atributos estruturados com evidência e confiança', () => {
    const parsed = profileBioExtractionResultSchema.safeParse({
      candidates: [
        { field: 'experience_years', value: 15, evidence: 'Mestro há 15 anos', confidence: 0.98 },
        { field: 'specialties', value: 'The Witcher', evidence: 'Fanático por The Witcher', confidence: 0.91 },
        { field: 'languages', value: 'Inglês', evidence: 'mestrei campanhas em inglês', confidence: 0.89 },
        { field: 'badges', value: 'Editor', evidence: 'Editor do site', confidence: 0.9 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejeita campo inventado, experiência fracionária e sugestão sem evidência', () => {
    for (const candidate of [
      { field: 'tagline', value: 'O melhor mestre', evidence: 'bio', confidence: 0.8 },
      { field: 'experience_years', value: 1.5, evidence: 'um ano e meio', confidence: 0.8 },
      { field: 'badges', value: 'Streamer', confidence: 0.8 },
    ]) {
      expect(profileBioExtractionResultSchema.safeParse({ candidates: [candidate] }).success).toBe(false);
    }
  });
});

/**
 * Achado de review (PR #301): o schema aceita qualquer `evidence` nao vazia, entao
 * uma alucinacao estruturalmente valida chegava a tela como `Trecho: "..."` e o
 * mestre confirmava o atributo acreditando que a frase era dele.
 */
describe('filterCandidatesByEvidence — evidencia tem de estar na bio', () => {
  const bio = 'Sou mestre há 15 anos. Fanático por The Witcher, e mestrei campanhas em inglês.';

  it('mantem candidato cuja evidencia existe no texto, ignorando caixa e acento', () => {
    const filtered = filterCandidatesByEvidence({
      candidates: [
        { field: 'experience_years', value: 15, evidence: 'Sou mestre há 15 anos', confidence: 0.9 },
        { field: 'specialties', value: 'The Witcher', evidence: 'FANATICO POR THE WITCHER', confidence: 0.9 },
        { field: 'languages', value: 'Inglês', evidence: 'campanhas   em ingles', confidence: 0.8 },
      ],
    }, bio);
    expect(filtered.candidates).toHaveLength(3);
  });

  it('descarta evidencia que o modelo inventou', () => {
    const filtered = filterCandidatesByEvidence({
      candidates: [
        { field: 'badges', value: 'Streamer', evidence: 'faço streams toda semana', confidence: 0.95 },
        { field: 'specialties', value: 'The Witcher', evidence: 'Fanático por The Witcher', confidence: 0.9 },
      ],
    }, bio);
    expect(filtered.candidates).toHaveLength(1);
    expect(filtered.candidates[0]?.value).toBe('The Witcher');
  });

  it('parafrase nao passa — o contrato do modulo e extracao literal', () => {
    const filtered = filterCandidatesByEvidence({
      candidates: [
        { field: 'experience_years', value: 15, evidence: 'possui quinze anos de experiencia', confidence: 0.9 },
      ],
    }, bio);
    expect(filtered.candidates).toHaveLength(0);
  });
});
