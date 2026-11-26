import { describe, expect, it } from 'vitest';
import { parseDiscordAnnouncement } from '../parseDiscordAnnouncement.js';
import type { ImportRawMessage } from '../types.js';

// Linhas reais de anúncios que o parser deixava sem dia (ou com o dia errado) em produção.
function dayOf(lines: string[], aliases?: Record<string, string[]>): string | null | undefined {
  const message: ImportRawMessage = {
    source_kind: 'discord_bot',
    discord_message_id: '1',
    discord_channel_id: '2',
    discord_guild_id: '3',
    discord_author_id: '4',
    discord_author_name: 'anunciante',
    discord_message_url: null,
    content_raw: ['▬ Título: Mesa', ...lines].join('\n'),
    attachments: [],
    embeds: [],
    message_created_at: null,
    message_edited_at: null,
  };
  return parseDiscordAnnouncement(message, [], undefined, undefined, aliases)?.table.day_of_week;
}

describe('dia "a definir" pela linha de agenda', () => {
  it.each([
    '▬ Data e Hora:  A discutir.',
    '**▬ Data e Hora:** (a decidir)',
    '**▬ Data e Hora:** dia ainda a decidir, durante a noite',
    '▬ Data e Hora: Dia a ser decidido começando 19h',
    '▬ Data & Horário: Flexível. Normalmente de noite.',
    '▬ Dias e horários da mesa: Dias e horários para serem definidos no formulário',
    '» Dias e horários da mesa: **À definir**',
    '▬ Data: Tenho todos os Horários Livres',
    '𝐃𝐢𝐚/𝐇𝐨𝐫𝐚́𝐫𝐢𝐨: em horários e dias diversos',
  ])('%s', (line) => {
    expect(dayOf([line])).toBe('to_define');
  });

  it('dia citado no corpo não vence a linha de agenda "a definir"', () => {
    expect(dayOf(['» Dias e horários da mesa: **A definir**', 'Chamo os aceitos na sexta.'])).toBe('to_define');
  });

  it.each([
    ['▬ Data e Hora: Aos Sábados, Horário a decidir', 'sábado'],
    ['Data e Hora: Segunda ou Terça-Feira, Horário a combinar', 'segunda'],
    ['» Dias e horários da mesa: Quinta as 20h', 'quinta'],
  ])('mantém o dia declarado: %s', (line, day) => {
    expect(dayOf(['» Data Limite: até quarta dia 25', line])).toBe(day);
  });

  it('data de calendário não vira "a definir"', () => {
    expect(dayOf(['▬ Data: 12/10 às 19h'])).toBeNull();
  });

  it('rótulo aprendido de dia vence uma linha "Data:" genérica', () => {
    expect(dayOf(['▬ Data: a combinar', 'Quando jogamos: terça'], { day_of_week: ['quando jogamos'] })).toBe('terça');
  });
});
