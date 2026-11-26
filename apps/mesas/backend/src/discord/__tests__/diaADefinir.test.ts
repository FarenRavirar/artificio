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

  it.each(['12/10', '12-10 às 19h', '12 de outubro', '1º out', 'ter. 19h', '3ª-feira', 'Semanalmente, 19h', 'Horário flexível', 'Semanal, qualquer horário', 'Semanal, horários livres', 'Tenho todos os Horários Livres'])('dia ilegível não vira "a definir": %s', (value) => {
    expect(dayOf([`▬ Data: ${value}`])).toBeNull();
  });

  it('dia na linha seguinte ao rótulo é mantido', () => {
    expect(dayOf(['▬ Dias e horários: Horário a definir', 'Quinta-feira'])).toBe('quinta');
    expect(dayOf(['▬ Dias: dias e horários a definir', 'Chamo os aceitos na sexta.'])).toBe('to_define');
    expect(dayOf(['▬ Dias e horários: Semanalmente', 'Sempre às quintas-feiras às 20:00'])).toBe('quinta');
    expect(dayOf(['▬ Dias e horários: Livres', 'Data Limite: até quarta'])).toBe('to_define');
    expect(dayOf(['▬ Dias e horários:', 'Semanalmente', 'Quinta-feira às 20h'])).toBe('quinta');
    expect(dayOf(['▬ Dias e horários: Semanalmente', 'Quinta-feira às 20h'])).toBe('quinta');
  });

  it('"a definir" na linha abaixo do rótulo vazio', () => {
    expect(dayOf(['▬ Dias e horários:', 'A definir'])).toBe('to_define');
  });

  it.each([
    'Data e horário a definir',
    'Dia/horário: a combinar',
    '▬ Dia(s) do jogo: indefinido',
    '▬ Dias e horários das sessões:     a    combinar',
  ])('reconhece variação: %s', (line) => {
    expect(dayOf([line])).toBe('to_define');
  });

  it.each(['Horário ainda a decidir', 'Horário a ser definido', 'Horários flexíveis'])(
    'indefinição só do horário não decide o dia: %s',
    (value) => {
      expect(dayOf([`▬ Data: ${value}`, 'Quinta-feira'])).toBe('quinta');
    },
  );

  it('"Final de semana qualquer horário" fala do dia', () => {
    expect(dayOf(['▬ Dias e horários: Final de semana qualquer horário.'])).toBe('to_define');
  });

  it('rótulo aprendido que diz "a combinar" vira to_define', () => {
    expect(dayOf(['Quando jogamos: a combinar'], { day_of_week: ['quando jogamos'] })).toBe('to_define');
  });

  it('linha com muitos espaços não trava o parser', () => {
    const started = Date.now();
    dayOf([`▬ Data: dia${' '.repeat(50_000)}X`]);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('rótulo aprendido de dia vence uma linha "Data:" genérica', () => {
    expect(dayOf(['▬ Data: a combinar', 'Quando jogamos: terça'], { day_of_week: ['quando jogamos'] })).toBe('terça');
  });
});
