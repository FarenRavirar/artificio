import { observarIdsDoAnuncio, aplicarMapeamentos } from '../roleMappings.js';
import type { DiscordRoleMapping } from '../../db/types.js';

// Linhas REAIS do PlayRay (extracao2 [part 2].json), medidas em 2026-09-02.
describe('roleMappings — inferencia a partir do anuncio real', () => {
  it('deduz kind=system de "Sistema: D&D 2024 - <@&id>" e guarda o texto vizinho', () => {
    const obs = observarIdsDoAnuncio('» Sistema: D&D 2024 - <@&1118328496721248347>');
    expect(obs).toHaveLength(1);
    expect(obs[0].kind).toBe('system');
    expect(obs[0].discordId).toBe('1118328496721248347');
    expect(obs[0].textoVizinho).toBe('D&D 2024');
  });

  it('deduz kind=style de "Estilo:" com varias roles', () => {
    const obs = observarIdsDoAnuncio(
      '» Estilo: <@&1101647686379249745> <@&1101647214582960198> <@&1101647468439031808>',
    );
    expect(obs).toHaveLength(3);
    expect(obs.every((o) => o.kind === 'style')).toBe(true);
  });

  it('deduz kind=setting de "AMBIENTACAO:" mesmo em caixa alta', () => {
    const obs = observarIdsDoAnuncio('》AMBIENTACAO: <@&1101647194261569537> Dark Fantasy');
    expect(obs[0].kind).toBe('setting');
  });

  it('deduz kind=era de "Epoca:"', () => {
    const obs = observarIdsDoAnuncio('» Época: <@&1101647577813880953>');
    expect(obs[0].kind).toBe('era');
  });

  it('ignora role em linha sem rotulo conhecido', () => {
    expect(observarIdsDoAnuncio('Chamando <@&123456789012345678> para a mesa!')).toHaveLength(0);
  });

  it('rotulo vem do trecho ANTES dos dois-pontos, nao do valor', () => {
    // "época medieval" no VALOR nao pode transformar Ambientacao em era.
    const obs = observarIdsDoAnuncio('Ambientacao: <@&111111111111111111> época medieval');
    expect(obs[0].kind).toBe('setting');
  });
});

// `target_system_name` acompanha a linha porque `carregarMapeamentos` faz join com
// `systems`: para kind='system' o vinculo e o UUID e o nome so existe pelo join.
type LinhaDeTeste = Partial<DiscordRoleMapping> & { key: string; target_system_name?: string | null };

function mapa(entradas: LinhaDeTeste[]) {
  return new Map(entradas.map((e) => [e.key, e as DiscordRoleMapping]));
}

describe('roleMappings — aplicacao', () => {
  it('substitui role de SISTEMA pelo nome vindo do catalogo', () => {
    // A constraint `discord_role_mappings_target_coherent` EXIGE `target_text IS NULL`
    // quando kind='system'. A versao anterior deste teste fabricava a combinacao
    // proibida (`kind:'system'` + `target_text`) e por isso passava enquanto o codigo
    // real nunca traduzia uma role de sistema. Achado do Codex (P1).
    const m = mapa([{
      key: 'role:1118328496721248347',
      kind: 'system',
      target_text: null,
      target_system_id: '11111111-1111-1111-1111-111111111111',
      target_system_name: 'D&D 2024',
    }]);
    const out = aplicarMapeamentos('Sistema: <@&1118328496721248347>', m);
    expect(out).toContain('D&D 2024');
    expect(out).not.toContain('<@&');
  });

  it('substitui role de ESTILO pelo target_text', () => {
    const m = mapa([{ key: 'role:1118328496721248348', kind: 'style', target_text: 'Investigacao' }]);
    const out = aplicarMapeamentos('Estilo: <@&1118328496721248348>', m);
    expect(out).toContain('Investigacao');
    expect(out).not.toContain('<@&');
  });

  it('role de sistema sem nome resolvido PRESERVA a mencao', () => {
    // Sistema removido do catalogo depois de confirmado: deixar o id visivel e melhor
    // que entregar "Sistema:" vazio, que leria como anuncio sem sistema nenhum.
    const m = mapa([{
      key: 'role:1118328496721248347',
      kind: 'system',
      target_text: null,
      target_system_id: null,
      target_system_name: null,
    }]);
    const out = aplicarMapeamentos('Sistema: <@&1118328496721248347>', m);
    expect(out).toContain('<@&1118328496721248347>');
  });

  it('capitular cola na palavra seguinte, sem espaco', () => {
    const m = mapa([{ key: 'emoji:1544078433875927091', kind: 'letter', target_text: 'E' }]);
    const out = aplicarMapeamentos('<:emoji_15:1544078433875927091>ra uma vez', m);
    expect(out).toBe('Era uma vez');
  });

  it('id sem mapeamento confirmado fica intacto (nao inventa dado)', () => {
    const out = aplicarMapeamentos('Sistema: <@&999999999999999999>', new Map());
    expect(out).toContain('<@&999999999999999999>');
  });
});

describe('roleMappings — capitular (emoji colado a palavra)', () => {
  it('observa emoji colado como kind letter, fora de linha rotulada', () => {
    // Sem este caso o kind 'letter' era INALCANCAVEL: nada o produzia, o emoji nunca
    // chegava a fila de revisao, e a normalizacao seguia comendo a inicial do
    // paragrafo. Achado do Codex (P2).
    const obs = observarIdsDoAnuncio('<:emoji_15:1544078433875927091>ra uma vez');
    expect(obs).toHaveLength(1);
    expect(obs[0].kind).toBe('letter');
    expect(obs[0].sourceType).toBe('emoji');
    expect(obs[0].discordId).toBe('1544078433875927091');
    // O resto da palavra e a unica evidencia da letra: com "ra uma vez" a vista, o
    // revisor deduz "E".
    expect(obs[0].textoVizinho).toContain('ra');
  });

  it('emoji SEGUIDO DE ESPACO nao e capitular', () => {
    // Emoji decorativo no meio do texto nao inicia palavra nenhuma.
    const obs = observarIdsDoAnuncio('mesa <:decorativo:1544078433875927092> nova');
    expect(obs).toHaveLength(0);
  });

  it('linha ROTULADA continua sendo tratada como dado, nao capitular', () => {
    // A ordem importa: o ramo do rotulo tem precedencia e faz `continue`.
    const obs = observarIdsDoAnuncio('Estilo: <:emoji_9:1544078433875927093>investigacao');
    expect(obs).toHaveLength(1);
    expect(obs[0].kind).toBe('style');
  });

  it('varios capitulares na mesma mensagem viram observacoes distintas', () => {
    const obs = observarIdsDoAnuncio(
      ['<:a:1544078433875927094>ntes', '<:d:1544078433875927095>epois'].join('\n'),
    );
    expect(obs).toHaveLength(2);
    expect(obs.every((o) => o.kind === 'letter')).toBe(true);
  });
});
