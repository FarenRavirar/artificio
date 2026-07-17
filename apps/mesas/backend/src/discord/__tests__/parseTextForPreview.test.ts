import { describe, expect, it, vi } from 'vitest';

vi.mock('../parseLearning', () => ({
  recordParseCase: vi.fn().mockResolvedValue('parse-case-fake-id'),
}));

import { parseTextForPreview } from '../parseTextForPreview.js';
import { recordParseCase } from '../parseLearning.js';

describe('parseTextForPreview (requisito 8, spec 079)', () => {
  it('reaproveita a engine do parser e devolve campos sugeridos + parseCaseId', async () => {
    const text = [
      'Título: Mesa de Teste',
      'Sistema: D&D 5e',
      'Data e Hora: Segunda-feira às 20h',
      'Vagas: 4',
      'Contato: https://forms.gle/exemplo',
    ].join('\n');

    const result = await parseTextForPreview(text);

    expect(result.parseCaseId).toBe('parse-case-fake-id');
    expect(result.table?.title).toBe('Mesa de Teste');
    expect(recordParseCase).toHaveBeenCalledWith(
      expect.objectContaining({ finalAction: 'draft', finalResult: null }),
    );
  });

  it('normaliza labels grudados (requisito 1) antes de parsear — texto colado com labels numa linha só', async () => {
    const text = 'Título: Mesa Corrida Sistema: Vampiro Vagas: 3';
    const result = await parseTextForPreview(text);

    expect(result.table?.title).toBe('Mesa Corrida');
  });

  it('devolve table=null e parseCaseId=null para texto vazio/sem segmentos', async () => {
    const result = await parseTextForPreview('   ');
    expect(result.table).toBeNull();
    expect(result.parseCaseId).toBeNull();
  });

  it('devolve table=null quando o parser descarta o anúncio (sistema autoral nítido)', async () => {
    const text = 'Título: Mesa\nSistema: Próprio\nVagas: 4';
    const result = await parseTextForPreview(text);
    expect(result.table).toBeNull();
  });

  it('pega só o primeiro segmento quando o texto colado tem múltiplos anúncios', async () => {
    const first = 'Título: Primeira Mesa\nSistema: D&D 5e\nVagas: 4';
    const second = 'Título: Segunda Mesa\nSistema: Pathfinder 2e\nVagas: 2';
    const result = await parseTextForPreview(`${first}\n---\n${second}`);
    expect(result.table?.title).toBe('Primeira Mesa');
  });
});
