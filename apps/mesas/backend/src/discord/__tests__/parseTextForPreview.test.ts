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

  // ─── Fase 6 (spec 096, T6.6/A9) — fixtures do §Gap 4, ponta a ponta ──────
  // O preview é a fronteira que o front consome: além do valor extraído, o
  // `table` carrega os sinais de ambiguidade (T6.2) e o raw_system_hint (F8).
  // F1 (catálogos ligados na ROTA) vive em gmPanel.parsePreview.test.ts e F2
  // (schedules×sessions) no frontend.

  it('F3: "Vagas: 4 (2 abertas)" → slots_total=4, slots_open=2 no preview', async () => {
    const result = await parseTextForPreview('Título: Mesa\nVagas: 4 (2 abertas)');
    expect(result.table?.slots_total).toBe(4);
    expect(result.table?.slots_open).toBe(2);
  });

  it('F4: "Contato: Discord @ricardo" → contato discord com o @username no preview', async () => {
    const result = await parseTextForPreview('Título: Mesa\nContato: Discord @ricardo');
    expect(result.contacts).toContainEqual(
      expect.objectContaining({ channel: 'discord', value: '@ricardo' }),
    );
  });

  it('F5: "necessário ter PC e microfone" → requires_pc=true e requires_microphone=true', async () => {
    const result = await parseTextForPreview('Título: Mesa\nRequisitos: necessário ter PC e microfone');
    expect(result.table?.requires_pc).toBe(true);
    expect(result.table?.requires_microphone).toBe(true);
  });

  it('F6: ambiguidade de preço chega no payload do preview (sinal + missing_fields)', async () => {
    // Gratuidade + sinal de cobrança, sem padrão de período promocional: o
    // parser não decide e sinaliza (um "R$ N" explícito seria resolvido como
    // paga — nível 1 do extractPrice é o sinal mais forte que existe).
    const result = await parseTextForPreview(
      'Título: Mesa\nMesa gratuita\nPagamento via PIX\nVagas: 4',
    );
    expect(result.table?._price_ambiguity).toBe(true);
    expect(result.table?.missing_fields).toContain('price_type:ambiguous');
  });

  it('T6.2: _extracted_fields lista SÓ o que o texto trouxe — default do builder fica de fora', async () => {
    const soTitulo = await parseTextForPreview('Mesa do Corvo');
    // O objeto de campos chega completo (price_type:'gratuita', type:'campanha',
    // requires_pc:false...), mas nada disso foi extraído do texto.
    expect(soTitulo.table?.price_type).toBe('gratuita');
    expect(soTitulo.table?._extracted_fields).toEqual(['title']);

    const comPreco = await parseTextForPreview('Mesa do Corvo\nValor: gratuito');
    // Mesmo valor final, origem diferente: aqui o anúncio CITA a gratuidade.
    expect(comPreco.table?.price_type).toBe('gratuita');
    expect(comPreco.table?._extracted_fields).toContain('price_type');
  });

  it('T6.2: _extracted_fields cobre os campos citados num anúncio rico', async () => {
    const result = await parseTextForPreview(
      'Mesa do Corvo\nDescrição: aventura sombria.\nModalidade: presencial\nValor: R$ 30\nVagas: 4',
    );
    const fields = result.table?._extracted_fields as string[];
    expect(fields).toContain('title');
    expect(fields).toContain('description');
    expect(fields).toContain('modality');
    expect(fields).toContain('price_type');
    expect(fields).toContain('price_value');
    expect(fields).toContain('slots_total');
  });

  it('F7: "Mensal: 40" → price_value_monthly no preview; "Doações: R$ 10" → doação em mesa gratuita', async () => {
    const monthly = await parseTextForPreview('Título: Mesa Paga\nMensal: 40');
    expect(monthly.table?.price_type).toBe('paga');
    expect(monthly.table?.price_value_monthly).toBe(40);

    const donation = await parseTextForPreview(
      'Título: Mesa Gratuita\nValor: gratuito\nDoações: R$ 10',
    );
    expect(donation.table?.price_type).toBe('gratuita');
    expect(donation.table?.accepts_donations).toBe(true);
    expect(donation.table?.suggested_donation_value).toBe(10);
  });

  it('F8: sistema não casado devolve raw_system_hint no preview (sem inventar correspondência)', async () => {
    const result = await parseTextForPreview('Título: Mesa\nSistema: Xyz Nada a Ver');
    expect(result.table?.system_id).toBeNull();
    expect(result.table?.raw_system_hint).toBe('Xyz Nada a Ver');
  });

  it('T6.1: catálogo VTT passado ao preview casa "Plataformas: Roll20" (era sempre null)', async () => {
    const result = await parseTextForPreview(
      'Título: Mesa\nPlataformas: Roll20\nVagas: 4',
      [],
      { vtt: [{ id: 'vtt-roll20', name: 'Roll20', aliases: [] }] },
    );
    expect(result.table?.vtt_platform_id).toBe('vtt-roll20');
  });

  it('T6.1: aliases aprendidos são passados ao parser (rótulo fora da allowlist fixa)', async () => {
    const result = await parseTextForPreview(
      'Título: Mesa\nJogo do dia: D&D\nVagas: 4',
      [],
      undefined,
      { system_name: ['jogo do dia'] },
    );
    expect(result.table?.raw_system_hint).toBe('D&D');
  });
});
