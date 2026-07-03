import { isValidTime, normalizeTime, extractContacts, validateDraftForSync, buildTableData } from '../syncHelpers';
import type { ImportTableDraft, DiscordTableDraftTable } from '../types';

function makeDraftTable(overrides: Partial<DiscordTableDraftTable> = {}): DiscordTableDraftTable {
  return {
    title: 'Mesa Teste',
    system_name: null,
    system_id: 'sys-1',
    raw_system_hint: null,
    type: 'campanha',
    modality: 'online',
    price_type: 'gratuita',
    price_value: null,
    slots_total: 4,
    slots_filled: 0,
    slots_open: 4,
    day_of_week: 'sabado',
    start_time: '19:00',
    frequency: null,
    description: 'descricao',
    contact_discord: null,
    contact_url: null,
    host_discord_id: null,
    scenario_id: null,
    raw_scenario_hint: null,
    vtt_platform_id: null,
    communication_platform_id: null,
    age_rating: null,
    setting_name: null,
    setting_styles: null,
    experience_level: null,
    table_level: null,
    requires_pc: null,
    requires_camera: null,
    requires_microphone: null,
    session_zero_free: null,
    cover_url: null,
    cover_url_source: null,
    cover_quality: null,
    _slots_ambiguity: null,
    _homebrew_suspect: null,
    _notes: [],
    ...overrides,
  };
}

function makeDraft(overrides: Partial<DiscordTableDraftTable> = {}): ImportTableDraft {
  return {
    source: {} as ImportTableDraft['source'],
    table: makeDraftTable(overrides),
    confidence: 1,
    confidence_tier: 'high' as ImportTableDraft['confidence_tier'],
    missing_fields: [],
  };
}

describe('isValidTime', () => {
  it('accepts valid HH:MM from 00:00 to 23:59', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('08:30')).toBe(true);
    expect(isValidTime('19:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
  });

  it('accepts valid HH:MM:SS', () => {
    expect(isValidTime('19:00:00')).toBe(true);
    expect(isValidTime('23:59:59')).toBe(true);
  });

  it('rejects impossible hours (24:00, 99:99)', () => {
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('99:99')).toBe(false);
    expect(isValidTime('25:30')).toBe(false);
  });

  it('rejects impossible minutes', () => {
    expect(isValidTime('12:60')).toBe(false);
    expect(isValidTime('12:99')).toBe(false);
  });

  it('rejects invalid formats', () => {
    expect(isValidTime('')).toBe(false);
    expect(isValidTime('abc')).toBe(false);
    expect(isValidTime('20h')).toBe(false);
    expect(isValidTime(19)).toBe(false);
    expect(isValidTime(null)).toBe(false);
    expect(isValidTime(undefined)).toBe(false);
  });
});

describe('normalizeTime', () => {
  it('normalizes "19h" → "19:00"', () => {
    expect(normalizeTime('19h')).toBe('19:00');
  });

  it('normalizes "20h30" → "20:30"', () => {
    expect(normalizeTime('20h30')).toBe('20:30');
  });

  it('returns "19:00" unchanged (already valid)', () => {
    expect(normalizeTime('19:00')).toBe('19:00');
  });

  it('returns null for invalid hour (99h → 99:00 rejected by isValidTime)', () => {
    expect(normalizeTime('99h')).toBeNull();
  });

  it('returns null for invalid hour (25h30 → 25:30 rejected by isValidTime)', () => {
    expect(normalizeTime('25h30')).toBeNull();
  });

  it('returns null for invalid minute (12h99 → 12:99 rejected by isValidTime)', () => {
    expect(normalizeTime('12h99')).toBeNull();
  });

  it('returns null for non-time text', () => {
    expect(normalizeTime('noite')).toBeNull();
    expect(normalizeTime('')).toBeNull();
  });
});

// ─── Fase G/F (spec 058): fallback de contato via host_discord_id + categorização real ───

describe('extractContacts', () => {
  it('fallback pro host_discord_id quando não há contact_url nem contact_discord (Fase G)', () => {
    const draft = makeDraft({ host_discord_id: 'author-123' });
    const contacts = extractContacts(draft);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ channel: 'discord', value: 'author-123' });
  });

  it('não usa fallback quando já há contact_discord explícito', () => {
    const draft = makeDraft({ contact_discord: 'explicit-discord', host_discord_id: 'author-123' });
    const contacts = extractContacts(draft);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ channel: 'discord', value: 'explicit-discord' });
  });

  it('retorna vazio quando não há nenhum sinal de contato (nem host_discord_id)', () => {
    const draft = makeDraft({});
    expect(extractContacts(draft)).toHaveLength(0);
  });

  it('categoriza link de WhatsApp como channel whatsapp, não form (Fase F)', () => {
    const draft = makeDraft({ contact_url: 'https://wa.me/5511999999999' });
    const contacts = extractContacts(draft);

    expect(contacts.some((c) => c.channel === 'whatsapp')).toBe(true);
  });

  it('categoriza link de Discord como channel discord', () => {
    const draft = makeDraft({ contact_url: 'https://discord.gg/abc123' });
    const contacts = extractContacts(draft);

    expect(contacts.some((c) => c.channel === 'discord')).toBe(true);
  });

  it('categoriza outro link qualquer como form (fallback genérico mantido)', () => {
    const draft = makeDraft({ contact_url: 'https://forms.gle/abc123' });
    const contacts = extractContacts(draft);

    expect(contacts.some((c) => c.channel === 'form')).toBe(true);
  });
});

describe('buildTableData — Fase E (spec 058): campos novos da Fase B/C propagados pra mesa publicada', () => {
  it('propaga todos os campos novos do draft pro insert da mesa (sem perda silenciosa)', () => {
    const draft = makeDraft({
      scenario_id: 'scenario-1',
      age_rating: '18+',
      vtt_platform_id: 'foundry',
      communication_platform_id: 'discord-plat',
      experience_level: 'veterano',
      table_level: 'avancado',
      setting_name: 'Golarion',
      setting_styles: ['Fantasia', 'Mistério'],
      requires_pc: true,
      requires_camera: true,
      requires_microphone: true,
      session_zero_free: true,
    });

    const tableData = buildTableData(draft, { sourceId: 'src-1', sourceUrl: null, gmName: 'GM' }, 'slug-1', null);

    expect(tableData).toMatchObject({
      scenario_id: 'scenario-1',
      age_rating: '18+',
      vtt_platform_id: 'foundry',
      communication_platform_id: 'discord-plat',
      experience_level: 'veterano',
      table_level: 'avancado',
      setting_name: 'Golarion',
      setting_styles: ['Fantasia', 'Mistério'],
      requires_pc: true,
      requires_camera: true,
      requires_microphone: true,
      session_zero_free: true,
    });
  });

  it('usa defaults seguros (false/null/todos) quando campos novos não vieram preenchidos', () => {
    const draft = makeDraft({});
    const tableData = buildTableData(draft, { sourceId: 'src-1', sourceUrl: null, gmName: 'GM' }, 'slug-1', null);

    expect(tableData).toMatchObject({
      scenario_id: null,
      age_rating: null,
      vtt_platform_id: null,
      communication_platform_id: null,
      experience_level: 'todos',
      table_level: null,
      setting_name: null,
      setting_styles: null,
      requires_pc: false,
      requires_camera: false,
      requires_microphone: false,
      session_zero_free: false,
    });
  });
});

describe('validateDraftForSync — Fase G (host_discord_id conta como contato válido)', () => {
  it('não bloqueia sync quando só há host_discord_id (sem contact_url/contact_discord)', () => {
    const draft = makeDraft({ host_discord_id: 'author-123' });
    const missing = validateDraftForSync(draft);

    expect(missing).not.toContain('contact_url/contact_discord');
  });

  it('bloqueia sync quando não há contact_url, contact_discord nem host_discord_id', () => {
    const draft = makeDraft({});
    const missing = validateDraftForSync(draft);

    expect(missing).toContain('contact_url/contact_discord');
  });
});
