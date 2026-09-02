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

function mapa(entradas: Array<Partial<DiscordRoleMapping> & { key: string }>) {
  return new Map(entradas.map((e) => [e.key, e as DiscordRoleMapping]));
}

describe('roleMappings — aplicacao', () => {
  it('substitui a role pelo texto, e o parser passa a ler como se fosse escrito', () => {
    const m = mapa([{ key: 'role:1118328496721248347', kind: 'system', target_text: 'D&D 2024' }]);
    const out = aplicarMapeamentos('Sistema: <@&1118328496721248347>', m);
    expect(out).toContain('D&D 2024');
    expect(out).not.toContain('<@&');
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
