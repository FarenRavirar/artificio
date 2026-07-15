import { describe, expect, it } from 'vitest';
import { parseDiscordAnnouncement } from './parseDiscordAnnouncement';
import type { ImportRawMessage } from './types';

const SYSTEMS = [
  { id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, aliases: ['D&D', 'DD', 'DnD', 'Dungeons and Dragons', 'Dungeons n dragons'], slug: 'dungeons-dragons', path_slug: 'dungeons-dragons', node_type: 'system', parent_id: null },
  { id: 'dnd-root-2024', name: '2024', name_pt: null, aliases: ['D&D 5.5'], slug: 'dungeons-dragons--2024', path_slug: 'dungeons-dragons/2024', node_type: 'edition', parent_id: 'dnd' },
  { id: 'dnd-3.5e', name: '3.5e', name_pt: null, aliases: [], slug: 'dungeons-dragons--3-5e', path_slug: 'dungeons-dragons/dungeons-dragons--3-5e', node_type: 'edition', parent_id: 'dnd' },
  { id: 'dnd-4e', name: '4e', name_pt: null, aliases: [], slug: 'dungeons-dragons--4e', path_slug: 'dungeons-dragons/dungeons-dragons--4e', node_type: 'edition', parent_id: 'dnd' },
  { id: 'dnd-4e-v35', name: 'version 3.5', name_pt: null, aliases: [], slug: 'dungeons-dragons--4e--version-3-5', path_slug: 'dungeons-dragons/dungeons-dragons--4e/dungeons-dragons--4e--version-3-5', node_type: 'variant', parent_id: 'dnd-4e' },
  { id: 'dnd-1e', name: '1e', name_pt: '1ª Edição', aliases: ['D&D 1e'], slug: 'dungeons-dragons--1e', path_slug: 'dungeons-dragons/dungeons-dragons--1e', node_type: 'edition', parent_id: 'dnd' },
  { id: 'dnd-1e-2024', name: '2024 impossível', name_pt: null, aliases: [], slug: '2024', path_slug: 'dungeons-dragons/1e/2024', node_type: 'variant', parent_id: 'dnd-1e' },
  { id: 'dnd-5e', name: '5e', name_pt: null, aliases: [], slug: 'dungeons-dragons--5e', path_slug: 'dungeons-dragons/dungeons-dragons--5e', node_type: 'edition', parent_id: 'dnd' },
  { id: 'dnd-5e-2014', name: '2014', name_pt: null, aliases: [], slug: 'dungeons-dragons--5e--2014', path_slug: 'dungeons-dragons/dungeons-dragons--5e/dungeons-dragons--5e--2014', node_type: 'variant', parent_id: 'dnd-5e' },
  { id: 'dnd-5e-2024', name: '2024', name_pt: null, aliases: [], slug: 'dungeons-dragons--5e--2024', path_slug: 'dungeons-dragons/dungeons-dragons--5e/dungeons-dragons--5e--2024', node_type: 'variant', parent_id: 'dnd-5e' },
  { id: 'gamma', name: 'Gamma World', name_pt: null, aliases: ['D&D'], slug: 'gamma-world', path_slug: 'gamma-world', node_type: 'system', parent_id: null },
  { id: 'drakar', name: 'Drakar och Demoner', name_pt: null, aliases: ['Dragonbane', 'Dragons and Demons', 'Drakar & Demoner'], slug: 'drakar-och-demoner', path_slug: 'drakar-och-demoner', node_type: 'system', parent_id: null },
  { id: 'coc', name: 'Call of Cthulhu', name_pt: null, aliases: ['CoC'], slug: 'call-of-cthulhu', path_slug: 'call-of-cthulhu', node_type: 'system', parent_id: null },
  { id: 'coc-7e', name: '7e', name_pt: '7ª Edição', aliases: [], slug: 'call-of-cthulhu--7e', path_slug: 'call-of-cthulhu/call-of-cthulhu--7e', node_type: 'edition', parent_id: 'coc' },
  { id: 'coc-7e-pulp', name: 'Pulp', name_pt: null, aliases: [], slug: 'call-of-cthulhu--7e--pulp', path_slug: 'call-of-cthulhu/call-of-cthulhu--7e/call-of-cthulhu--7e--pulp', node_type: 'variant', parent_id: 'coc-7e' },
  { id: '3det', name: '3D&T', name_pt: null, aliases: ['3DeT'], slug: '3d-t', path_slug: '3d-t', node_type: 'system', parent_id: null },
  { id: '3det-victory', name: 'Victory', name_pt: null, aliases: ['3D&T Victory', '3DeT Victory'], slug: 'victory', path_slug: '3d-t/victory', node_type: 'edition', parent_id: '3det' },
  { id: 'ose', name: 'Old-School Essentials', name_pt: null, aliases: ['OSE'], slug: 'old-school-essentials', path_slug: 'old-school-essentials', node_type: 'system', parent_id: null },
  { id: 'vampire', name: 'Vampire', name_pt: 'Vampiro', aliases: ['VtM'], slug: 'vampire', path_slug: 'vampire', node_type: 'system', parent_id: null },
  { id: 'vampire-5e', name: 'Vampire 5e', name_pt: null, aliases: ['V5'], slug: 'vampire-5e', path_slug: 'vampire/vampire-5e', node_type: 'edition', parent_id: 'vampire' },
  { id: 'werewolf', name: 'Werewolf', name_pt: null, aliases: ['Lobisomem: O Apocalipse', 'Lobisomem o Apocalipse'], slug: 'werewolf', path_slug: 'werewolf', node_type: 'system', parent_id: null },
  { id: 'mutants-masterminds', name: 'Mutants & Masterminds', name_pt: 'Mutantes e Malfeitores', aliases: ['Mutants And Masterminds'], slug: 'mutants-masterminds', path_slug: 'mutants-masterminds', node_type: 'system', parent_id: null },
] satisfies NonNullable<Parameters<typeof parseDiscordAnnouncement>[1]>;

function message(system: string): ImportRawMessage {
  return {
    source_kind: 'discord_chat_exporter_json',
    discord_message_id: 'message-1',
    discord_channel_id: 'channel-1',
    discord_guild_id: 'guild-1',
    discord_thread_name: 'Uma aventura de teste',
    discord_author_id: 'author-1',
    discord_author_name: 'Mestre',
    discord_message_url: null,
    content_raw: `Título: Uma aventura de teste\nSistema: ${system}\nVagas disponíveis: 2 de 6\nContato: <@123456789>`,
    attachments: [],
    embeds: [],
    message_created_at: new Date('2026-07-14T12:00:00Z'),
    message_edited_at: null,
  };
}

describe('parseDiscordAnnouncement — hierarquia de sistemas', () => {
  it('percorre sistema → edição → variante por filhos diretos', () => {
    const parsed = parseDiscordAnnouncement(message('D&D 5e 2024'), SYSTEMS);

    expect(parsed?.table.system_id).toBe('dnd-5e-2024');
    expect(parsed?.table.system_name).toBe('2024');
    expect(parsed?.table._system_candidates?.map((candidate) => candidate.system_id))
      .not.toContain('dnd-1e-2024');
    expect(parsed?.table._system_candidates?.map((candidate) => candidate.system_id))
      .not.toContain('gamma');
  });

  it('oferece variantes filhas quando a edição foi identificada', () => {
    const parsed = parseDiscordAnnouncement(message('D&D 5e'), SYSTEMS);
    const candidateIds = parsed?.table._system_candidates?.map((candidate) => candidate.system_id) ?? [];

    expect(parsed?.table.system_id).toBe('dnd-5e');
    expect(candidateIds).toContain('dnd-5e-2014');
    expect(candidateIds).toContain('dnd-5e-2024');
    expect(candidateIds).not.toContain('dnd-1e-2024');
  });

  it.each(['D&D 5e', 'D&D 5ª Edição', 'D&D 5ed'])('não deixa alias de outra edição sequestrar %s', (hint) => {
    const parsed = parseDiscordAnnouncement(message(hint), SYSTEMS);
    const candidateIds = parsed?.table._system_candidates?.map((candidate) => candidate.system_id) ?? [];

    expect(parsed?.table.system_id).toBe('dnd-5e');
    expect(candidateIds).not.toContain('gamma');
    expect(candidateIds).not.toContain('drakar');
    expect(candidateIds).not.toContain('dnd-1e');
    expect(candidateIds).not.toContain('dnd-root-2024');
  });

  it('reconhece variante textual em outro sistema sem pular a edição', () => {
    const parsed = parseDiscordAnnouncement(message('Call of Cthulhu 7e Pulp'), SYSTEMS);

    expect(parsed?.table.system_id).toBe('coc-7e-pulp');
    expect(parsed?.table.system_name).toBe('Pulp');
  });

  it('não anexa variante quando o anúncio omite a edição', () => {
    const parsed = parseDiscordAnnouncement(message('D&D 2014'), SYSTEMS);
    expect(parsed?.table.system_id).toBe('dnd');
  });

  it('mantém o pai quando o mesmo sinal existe em níveis diferentes', () => {
    const parsed = parseDiscordAnnouncement(message('D&D 2024'), SYSTEMS);
    expect(parsed?.table.system_id).toBe('dnd');
  });

  it('resolve ano curto depois de uma edição explícita', () => {
    const parsed = parseDiscordAnnouncement(message("D&D 5e'24"), SYSTEMS);
    expect(parsed?.table.system_id).toBe('dnd-5e-2024');
  });

  it('resolve edição por alias textual completo sem parar no sistema', () => {
    const parsed = parseDiscordAnnouncement(message('3DeT Victory'), SYSTEMS);
    expect(parsed?.table.system_id).toBe('3det-victory');
  });

  it('separa sistema e edição escritos sem espaço', () => {
    const parsed = parseDiscordAnnouncement(message('dnd5'), SYSTEMS);
    expect(parsed?.table.system_id).toBe('dnd-5e');
  });

  it.each([
    ['OSE', 'ose'],
    ['V5', 'vampire-5e'],
    ['Vampiro', 'vampire'],
    ['Mutantes e Malfeitores', 'mutants-masterminds'],
    ['Lobisomem: O Apocalipse', 'werewolf'],
  ])('resolve alias real %s sem aproximação inventada', (hint, expectedId) => {
    const parsed = parseDiscordAnnouncement(message(hint), SYSTEMS);
    expect(parsed?.table.system_id).toBe(expectedId);
  });

  it('trata versão decimal com ou sem e como a mesma edição', () => {
    const parsed = parseDiscordAnnouncement(message('D&D 3 5'), SYSTEMS);
    expect(parsed?.table.system_id).toBe('dnd-3.5e');
  });
});
