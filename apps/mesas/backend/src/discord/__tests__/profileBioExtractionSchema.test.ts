import { describe, expect, it } from 'vitest';
import { profileBioExtractionResultSchema } from '../llmAssist.js';

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
