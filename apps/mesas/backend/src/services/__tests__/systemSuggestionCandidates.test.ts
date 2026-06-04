import {
  normalizeSystemName,
  scoreSystemCandidates,
  type CandidateSystemInput,
  type CandidateAliasInput,
} from '../systemSuggestionCandidates';

describe('normalizeSystemName', () => {
  it('lower-cases, removes accents and commercial symbols', () => {
    const n = normalizeSystemName('Forgotten Realms™');
    expect(n.normalized).toBe('forgotten realms');
    expect(n.base).toBe('forgotten realms');
    expect(n.editionTokens).toEqual([]);
  });

  it('normalizes & to and', () => {
    const n = normalizeSystemName('Dungeons & Dragons');
    expect(n.normalized).toBe('dungeons and dragons');
    expect(n.base).toBe('dungeons and dragons');
  });

  it('detects year edition token and keeps base clean (D&D 5a edicao 2024)', () => {
    const n = normalizeSystemName('D&D 5ª edição 2024');
    // '5a' (PT ordinal) e '2024' sao tokens de edicao; 'edicao' e palavra de edicao removida
    expect(n.editionTokens).toEqual(expect.arrayContaining(['5a', '2024']));
    expect(n.base).toBe('d and d');
  });

  it('detects dotted version token (CAIN 1.3)', () => {
    const n = normalizeSystemName('CAIN 1.3');
    expect(n.editionTokens).toEqual(['1.3']);
    expect(n.base).toBe('cain');
  });

  it('detects edition like 5e', () => {
    const n = normalizeSystemName('Pathfinder 2e');
    expect(n.editionTokens).toEqual(['2e']);
    expect(n.base).toBe('pathfinder');
  });

  it('strips trailing generic RPG suffix for base (Pokemon RPG)', () => {
    const n = normalizeSystemName('Pokémon RPG');
    expect(n.base).toBe('pokemon');
    expect(n.editionTokens).toEqual([]);
  });

  it('strips roleplaying game as generic suffix but keeps game when it is part of the title', () => {
    expect(normalizeSystemName('The One Ring Roleplaying Game').base).toBe('one ring');
    expect(normalizeSystemName("Ender's Game").base).toBe('ender s game');
  });

  it('returns safe empty result for blank input', () => {
    const n = normalizeSystemName('   ');
    expect(n.normalized).toBe('');
    expect(n.base).toBe('');
    expect(n.editionTokens).toEqual([]);
  });
});

const SYSTEMS: CandidateSystemInput[] = [
  { id: 'dd', name: 'Dungeons & Dragons', name_pt: null, slug: 'dungeons-dragons', path_slug: 'dungeons-dragons', node_type: 'system', parent_id: null },
  { id: 'dd5e', name: '5th Edition', name_pt: '5ª Edição', slug: '5e', path_slug: 'dungeons-dragons/5e', node_type: 'edition', parent_id: 'dd' },
  { id: 'dd2024', name: '2024', name_pt: null, slug: '2024', path_slug: 'dungeons-dragons/2024', node_type: 'edition', parent_id: 'dd' },
  { id: 'cain', name: 'CAIN', name_pt: null, slug: 'cain', path_slug: 'cain', node_type: 'system', parent_id: null },
  { id: 'pokemon', name: 'Pokémon', name_pt: null, slug: 'pokemon', path_slug: 'pokemon', node_type: 'system', parent_id: null },
  { id: 'tor', name: 'The One Ring Roleplaying Game', name_pt: null, slug: 'the-one-ring-roleplaying-game', path_slug: 'the-one-ring-roleplaying-game', node_type: 'system', parent_id: null },
];

const ALIASES: CandidateAliasInput[] = [
  { system_id: 'dd', alias: 'D&D' },
  { system_id: 'dd5e', alias: 'D&D 5e' },
];

describe('scoreSystemCandidates', () => {
  it('matches an existing alias exactly and recommends merge', () => {
    const r = scoreSystemCandidates('D&D', SYSTEMS, ALIASES);
    expect(r.candidates[0].system_id).toBe('dd');
    expect(r.candidates[0].reasons).toContain('alias_exact');
    expect(r.candidates[0].score).toBeGreaterThanOrEqual(0.97);
    expect(r.recommended_action).toBe('merge_existing');
  });

  it('matches exact system name and recommends merge', () => {
    const r = scoreSystemCandidates('CAIN', SYSTEMS, ALIASES);
    expect(r.candidates[0].system_id).toBe('cain');
    expect(r.candidates[0].reasons).toContain('name_exact');
    expect(r.recommended_action).toBe('merge_existing');
  });

  it('flags base + edition token (CAIN 1.3) against the existing root, recommends child not new system', () => {
    const r = scoreSystemCandidates('CAIN 1.3', SYSTEMS, ALIASES);
    expect(r.candidates[0].system_id).toBe('cain');
    expect(r.candidates[0].reasons).toContain('base_plus_edition');
    expect(r.recommended_action).toBe('create_child');
  });

  it('recognizes D&D 5e 2014. as edition context of existing Dungeons & Dragons, not a new root', () => {
    const r = scoreSystemCandidates('D&D 5e 2014.', SYSTEMS, [{ system_id: 'dd', alias: 'DnD' }]);
    expect(r.candidates[0].system_id).toBe('dd');
    expect(r.candidates[0].reasons).toContain('base_plus_edition');
    expect(r.recommended_action).toBe('create_child');
    expect(r.analysis.suggested_child_name).toBe('5e 2014');
    expect(r.analysis.suggested_child_type).toBe('edition');
  });

  it('does not infer translated aliases that are not in catalog data', () => {
    const r = scoreSystemCandidates('O Um Anel 2e', SYSTEMS, []);
    expect(r.candidates).toEqual([]);
    expect(r.recommended_action).toBe('create_system');
  });

  it('recognizes O Um Anel 2e as edition context when O Um Anel exists as catalog alias', () => {
    const r = scoreSystemCandidates('O Um Anel 2e', SYSTEMS, [{ system_id: 'tor', alias: 'O Um Anel' }]);
    expect(r.candidates[0].system_id).toBe('tor');
    expect(r.candidates[0].reasons).toContain('base_plus_edition');
    expect(r.recommended_action).toBe('create_child');
    expect(r.analysis.suggested_child_name).toBe('2e');
    expect(r.analysis.suggested_child_type).toBe('edition');
  });

  it('recognizes O Um Anel as existing when O Um Anel is already a catalog alias', () => {
    const r = scoreSystemCandidates('O Um Anel', SYSTEMS, [{ system_id: 'tor', alias: 'O Um Anel' }]);
    expect(r.candidates[0].system_id).toBe('tor');
    expect(r.candidates[0].reasons).toContain('alias_exact');
    expect(r.recommended_action).toBe('merge_existing');
    expect(r.analysis.has_edition_context).toBe(false);
  });

  it('recommends merge when the suggested edition already exists under the matched parent', () => {
    const r = scoreSystemCandidates('D&D 2024', SYSTEMS, ALIASES);
    expect(r.candidates[0].system_id).toBe('dd2024');
    expect(r.candidates[0].reasons).toContain('existing_child_match');
    expect(r.recommended_action).toBe('merge_existing');
    expect(r.analysis.suggested_child_name).toBe('2024');
  });

  it('recognizes The One Ring Strider Mode as child context, not a new root', () => {
    const r = scoreSystemCandidates('The One Ring Strider Mode', SYSTEMS, []);
    expect(r.candidates[0].system_id).toBe('tor');
    expect(r.candidates[0].reasons).toContain('base_plus_qualifier');
    expect(r.recommended_action).toBe('create_child');
    expect(r.analysis.suggested_child_name).toBe('Strider Mode');
    expect(r.analysis.suggested_child_type).toBe('subsystem');
  });

  it('matches Pokemon RPG to existing Pokemon by base', () => {
    const r = scoreSystemCandidates('Pokémon RPG', SYSTEMS, ALIASES);
    expect(r.candidates[0].system_id).toBe('pokemon');
    expect(r.recommended_action).not.toBe('create_system');
  });

  it('recommends create_system when nothing is similar (On-Two-Six)', () => {
    const r = scoreSystemCandidates('On-Two-Six', SYSTEMS, ALIASES);
    expect(r.recommended_action).toBe('create_system');
  });

  it('does not match unrelated phrase acronyms without explicit acronym signal', () => {
    const r = scoreSystemCandidates(
      'Curse of Strahd',
      [{ id: 'changeling', name: 'Changeling', name_pt: null, slug: 'changeling', path_slug: 'changeling', node_type: 'system', parent_id: null }],
      [{ system_id: 'changeling', alias: 'Changeling: o sonhar' }],
    );
    expect(r.candidates).toEqual([]);
    expect(r.recommended_action).toBe('create_system');
  });

  it('returns candidates sorted by score descending and de-duplicated by system', () => {
    const r = scoreSystemCandidates('D&D 5e', SYSTEMS, ALIASES);
    const ids = r.candidates.map((c) => c.system_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < r.candidates.length; i += 1) {
      expect(r.candidates[i - 1].score).toBeGreaterThanOrEqual(r.candidates[i].score);
    }
  });

  it('does not throw on empty catalog and recommends create_system', () => {
    const r = scoreSystemCandidates('Whatever', [], []);
    expect(r.candidates).toEqual([]);
    expect(r.recommended_action).toBe('create_system');
  });
});
