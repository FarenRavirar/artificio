import { describe, expect, it } from 'vitest';
import { segmentAnnouncements } from './segmentation';

describe('segmentAnnouncements', () => {
  it('returns an empty list for blank or too-short input', () => {
    expect(segmentAnnouncements('   ')).toEqual([]);
    expect(segmentAnnouncements('curto')).toEqual([]);
  });

  it('keeps one announcement intact when no reliable separator exists', () => {
    const text = 'Título: Névoa sobre a cidade\nSistema: Vampiro V5';
    expect(segmentAnnouncements(text)).toEqual([text]);
  });

  it('splits announcements by explicit separators', () => {
    const first = 'Título: Primeira mesa\nSistema: D&D 5e';
    const second = 'Título: Segunda mesa\nSistema: Pathfinder 2e';
    expect(segmentAnnouncements(`${first}\n---\n${second}`)).toEqual([first, second]);
  });

  it('splits repeated headers without aggressively splitting field lines', () => {
    const first = 'Título: Primeira mesa\nDescrição longa da primeira mesa.';
    const second = 'Título: Segunda mesa\nDescrição longa da segunda mesa.';
    expect(segmentAnnouncements(`${first}\n${second}`)).toEqual([first, second]);
  });

  it('não separa em "▬▬▬" usado como decoração inline dentro de um único anúncio (bug real, anúncio "A CENSURA")', () => {
    const text = [
      'A CENSURA',
      '',
      '-Sistema: Vampiro, a máscara.',
      '-N de vagas: 5 vagas',
      '',
      '📖 Sinopse',
      '',
      'texto da sinopse aqui.',
      '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
      '',
      '📌 Inscrições: Chamar no Discord ou 93 992155816 no Whatsapp',
    ].join('\n');
    expect(segmentAnnouncements(text)).toEqual([text]);
  });

  it('ainda separa em "▬▬▬" quando de fato inicia um segundo anúncio', () => {
    const first = 'Título: Primeira mesa\nSistema: D&D 5e';
    const second = 'Título: Segunda mesa\nSistema: Pathfinder 2e';
    expect(segmentAnnouncements(`${first}\n▬▬▬▬\n${second}`)).toEqual([first, second]);
  });

  it('separa por cabeçalho de autor Discord ("Nome [tag], Ícone de cargo, Narradores — HH:MM") quando o mantenedor cola histórico de canal inteiro (spec 079, achado real 2026-07-16)', () => {
    const text = [
      'Fulano [TAG], Ícone de cargo, Narradores — 09:40',
      'Primeira Mesa',
      'Sistema: D&D 5e',
      'Ciclano, Ícone de cargo, Narradores — 10:11',
      'Segunda Mesa',
      'Sistema: Pathfinder 2e',
    ].join('\n');
    const segments = segmentAnnouncements(text);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toContain('Primeira Mesa');
    expect(segments[0]).not.toContain('Ícone de cargo');
    expect(segments[1]).toContain('Segunda Mesa');
    expect(segments[1]).not.toContain('Ícone de cargo');
  });

  it('cabeçalho de autor isolado (1 só) não ativa split-por-autor, mas ainda é removido do texto (achado de review, Codex PR #172)', () => {
    const text = 'Fulano [TAG], Ícone de cargo, Narradores — 09:40\nTítulo: Mesa única\nSistema: D&D 5e';
    // com só 1 header, splitByAuthorHeader não ativa (exige 2+) — mas a linha
    // de header é metadado de export, não conteúdo do anúncio, e precisa ser
    // removida antes dos fallbacks (splitBySeparators/splitByHeaders), senão
    // vaza pro segments[0] e contamina o parser (bug real: preview usa só
    // segments[0], virava metadado de autor em vez do anúncio real).
    const segments = segmentAnnouncements(text);
    expect(segments.some((s) => s.includes('Ícone de cargo'))).toBe(false);
    expect(segments.some((s) => s.includes('Título: Mesa única'))).toBe(true);
  });
});
