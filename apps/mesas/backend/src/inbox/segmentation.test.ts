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
});
