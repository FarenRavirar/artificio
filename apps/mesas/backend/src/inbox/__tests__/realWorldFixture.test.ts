import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { segmentAnnouncements } from '../segmentation';
import { normalizeLooseText } from '../normalizeLooseText';
import { parseDiscordAnnouncement, stripNullBytes } from '../../discord/parseDiscordAnnouncement';
import { textToRawMessage } from '../adapters/textToRawMessage';
import type { ImportTableDraft } from '../../discord/types';

// Spec 079: fixture com histórico REAL de canal Discord colado pelo mantenedor
// (2026-07-16), 22 anúncios de autores diferentes numa cola só — o mesmo tipo
// de texto que o fluxo "Importar texto" recebe na prática. Cobre requisitos 1
// (labels grudados), 2 (▬▬▬ inline, herdado spec 077), 3 (data/hora "a
// definir", herdado spec 077), 4 (WhatsApp), 5/6 (vagas/sistema contaminados —
// provados como sintoma do requisito 1, sem fix próprio).
function parseFixtureSegment(segment: string): ImportTableDraft | null {
  const normalized = normalizeLooseText(stripNullBytes(segment));
  const rawMessage = textToRawMessage(normalized, undefined);
  return parseDiscordAnnouncement(rawMessage);
}

function loadFixtureSegments(): string[] {
  const raw = readFileSync(
    path.join(__dirname, 'fixtures/discord-announcements-real.txt'),
    'utf-8',
  );
  return segmentAnnouncements(raw);
}

describe('fixture real de 22 anúncios colados (spec 079)', () => {
  it('segmenta em 22 anúncios (cabeçalho de autor Discord "Ícone de cargo, Narradores — HH:MM")', () => {
    const segments = loadFixtureSegments();
    expect(segments).toHaveLength(22);
  });

  it('não deixa nenhuma linha de cabeçalho de autor sobrevivendo dentro de um segmento', () => {
    const segments = loadFixtureSegments();
    for (const segment of segments) {
      expect(segment).not.toMatch(/Ícone de cargo, Narradores/);
    }
  });

  it('5 dos 22 são sistema autoral nítido ("próprio"/"autoral") e são corretamente descartados (DEB-048-27, comportamento intencional, não bug)', () => {
    const segments = loadFixtureSegments();
    const drafts = segments.map(parseFixtureSegment);
    const discarded = drafts.filter((d) => d === null);
    // "Arvore morta" (Olthin, Próprio), "Wonderland" (Sistema: Próprio),
    // "Residente" (Próprio D20), "Aventuras do Vôlei" (sistema próprio de
    // vôlei) e "Homestuck" (autoral) — todos batem RE_HOMEBREW_STRONG.
    expect(discarded).toHaveLength(5);
  });

  it('requisito 1: título não fica contaminado por texto de outro label grudado na mesma linha', () => {
    const segments = loadFixtureSegments();
    const drafts = segments.map(parseFixtureSegment).filter((d): d is ImportTableDraft => d !== null);
    const titles = drafts.map((d) => d.table.title);

    expect(titles).toContain('Hero Academy - Neo Neon');
    expect(titles).toContain('O Legado de Narrun');
    expect(titles).toContain('somewhere in Duskwood campanha curta');
    expect(titles).toContain('A Censura');
    expect(titles).toContain('Curse of Strahd');
    // Nenhum título deve conter o texto de outro campo (achado real: "vagas
    // 23" vindo de horário, "Título" literal vindo de sistema colado).
    for (const title of titles) {
      expect(title).not.toBe('Título');
      expect(title).not.toMatch(/^\d+$/);
    }
  });

  it('requisito 5/6 (sintoma do requisito 1): sistema e vagas não absorvem texto de campo vizinho nos casos reais "Narrun" e "Duskwood"', () => {
    const segments = loadFixtureSegments();
    const drafts = segments.map(parseFixtureSegment).filter((d): d is ImportTableDraft => d !== null);

    const narrun = drafts.find((d) => d.table.title === 'O Legado de Narrun');
    expect(narrun?.table.raw_system_hint ?? narrun?.table.system_id).toBeTruthy();
    expect(narrun?.table.raw_system_hint).not.toBe('Título');

    const duskwood = drafts.find((d) => d.table.title === 'somewhere in Duskwood campanha curta');
    expect(duskwood?.table.slots_total).toBe(4);
    expect(duskwood?.table.slots_open).toBe(1);
  });

  it('requisito 3 (herdado spec 077): "Data e hora: a definir" resolve day_of_week=to_define', () => {
    const segments = loadFixtureSegments();
    const drafts = segments.map(parseFixtureSegment).filter((d): d is ImportTableDraft => d !== null);
    const censura = drafts.find((d) => d.table.title === 'A Censura');
    expect(censura?.table.day_of_week).toBe('to_define');
  });

  it('requisito 4: telefone/WhatsApp em texto livre vira contact_url (link wa.me)', () => {
    const segments = loadFixtureSegments();
    const drafts = segments.map(parseFixtureSegment).filter((d): d is ImportTableDraft => d !== null);

    const censura = drafts.find((d) => d.table.title === 'A Censura');
    expect(censura?.table.contact_url).toBe('https://wa.me/5593992155816');

    const vampiroDarkAges = drafts.find((d) => (d.table.title ?? '').includes('Vampiro a Máscara Dark Ages'));
    expect(vampiroDarkAges?.table.contact_url).toBe('https://wa.me/5562994292879');
  });

  it('não gera contact_url de telefone quando já existe forms/URL/menção Discord explícita (WhatsApp é só fallback mais fraco)', () => {
    const segments = loadFixtureSegments();
    const drafts = segments.map(parseFixtureSegment).filter((d): d is ImportTableDraft => d !== null);
    const narrun = drafts.find((d) => d.table.title === 'O Legado de Narrun');
    // "O Legado de Narrun" tem link de formulário explícito — não deve virar wa.me.
    expect(narrun?.table.contact_url).toBe('https://forms.gle/e23HU3iYMUn1xhJc6');
  });

  it('achado real: "Mesa: Paga (...)" não vira título — "mesa" com valor de preço não é nome da mesa', () => {
    const segments = loadFixtureSegments();
    const drafts = segments.map(parseFixtureSegment).filter((d): d is ImportTableDraft => d !== null);
    const vampiroDarkAges = drafts.find((d) => (d.table.title ?? '').includes('Vampiro a Máscara Dark Ages'));
    expect(vampiroDarkAges?.table.title).not.toBe('Paga');
  });
});
