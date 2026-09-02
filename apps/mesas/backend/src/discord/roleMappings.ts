import { db } from '../db/index.js';
import type { DiscordRoleMapping, DiscordRoleMappingKind } from '../db/types.js';

/**
 * Traduz id opaco do Discord (role usada como tag, emoji usado como capitular)
 * para dado do catálogo. Spec 099.
 *
 * O problema: servidores marcam o sistema com ROLE em vez de texto — o anúncio
 * traz `Sistema: <@&1118328496721248347>` e nada mais. O export do Chat
 * Exporter **não carrega o nome da role** (`mentions: []` nos três arquivos
 * medidos em 2026-09-02), então o parser via só um número e o dado se perdia:
 * virava a nota "Role mencionada", que ninguém consome.
 *
 * A saída não é cadastro manual de tudo. O próprio anúncio ensina, porque a
 * role costuma aparecer ao lado do texto correspondente:
 *
 *     » Sistema: D&D 2024 - <@&1118328496721248347>
 *     ▬ Sistema: <@&1118328496721248347> 2014
 *
 * Duas mensagens diferentes, mesma role, "D&D" ao lado nas duas. Isso é
 * evidência suficiente para PROPOR o vínculo — e é o que este módulo faz.
 *
 * O que ele deliberadamente NÃO faz é aplicar a proposta sozinho: vínculo
 * inferido só entra no parse depois de confirmado por um humano
 * (`confirmed_at`). Dado errado no draft é pior que dado ausente, porque
 * ninguém revisa o que já parece certo.
 */

/** `<@&123>` → `123`. Também aceita `<@&123>` com `!`, que o Discord emite. */
const ROLE_MENTION_RE = /<@&!?(\d{15,25})>/g;
/** `<:nome:123>` / `<a:nome:123>` → id. */
const EMOJI_MENTION_RE = /<a?:[\w~]+:(\d{15,25})>/g;
/**
 * Emoji COLADO à palavra seguinte, sem espaço: o uso capitular (`<:e:1>ra uma vez`).
 * O grupo 2 captura o resto da palavra, que é a evidência de qual letra o emoji
 * representa — o export não traz o nome real do emoji em lugar nenhum.
 */
const CAPITULAR_RE = /<a?:[\w~]+:(\d{15,25})>([\p{L}][\p{L}\s]{0,40})/gu;

/**
 * Rótulo da linha → significado. As chaves espelham os rótulos que o parser já
 * reconhece (`parseDiscordAnnouncement.ts`), e não uma lista paralela: se o
 * parser aprender um rótulo novo, esta tabela precisa aprender junto.
 */
// SEM `\b` no início: em JS o `\b` é ASCII, então `\bépoca` NÃO casa com
// "Época" — o `é` não conta como word char e a borda nunca existe (medido).
// A ausência é segura porque o casamento roda só sobre o RÓTULO (trecho antes
// dos dois-pontos), não sobre a frase inteira.
const LABEL_TO_KIND: ReadonlyArray<{ re: RegExp; kind: DiscordRoleMappingKind }> = [
  { re: /(?:sistema|jogo|rpg|sistema de jogo|sistema utilizado)/i, kind: 'system' },
  { re: /(?:estilo|tema|temas|g[eê]nero|g[eê]neros|indicado)/i, kind: 'style' },
  { re: /(?:ambienta[cç][aã]o|cen[aá]rio)/i, kind: 'setting' },
  { re: /(?:[eé]poca|per[ií]odo|\bera\b)/i, kind: 'era' },
];

function kindDoRotulo(linha: string): DiscordRoleMappingKind | null {
  // Só o trecho ANTES dos dois-pontos é rótulo. Sem este corte, "Ambientação:
  // ... época medieval" casaria 'era' pelo texto do valor, não pelo rótulo.
  const rotulo = linha.split(':')[0] ?? '';
  return LABEL_TO_KIND.find((l) => l.re.test(rotulo))?.kind ?? null;
}

/**
 * Texto que sobra na linha depois de remover os ids — é a evidência do que a
 * role significa. Em `Sistema: D&D 2024 - <@&123>` devolve "D&D 2024".
 */
function textoVizinho(linha: string): string {
  return linha
    .replace(/^[^:]*:/, '')
    .replace(ROLE_MENTION_RE, ' ')
    .replace(EMOJI_MENTION_RE, ' ')
    // Separadores decorativos que sobram entre o texto e a menção removida.
    .replace(/[-–—•·|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ObservacaoDeId {
  discordId: string;
  sourceType: 'role' | 'emoji';
  kind: DiscordRoleMappingKind;
  /** Texto visto ao lado, quando houver. É o que sustenta a inferência. */
  textoVizinho: string | null;
}

/**
 * Varre o corpo do anúncio e devolve o que cada id parece significar.
 *
 * Puro de propósito (sem banco): é o que torna a regra testável com o texto
 * real dos anúncios, sem subir Postgres.
 */
export function observarIdsDoAnuncio(body: string): ObservacaoDeId[] {
  const achados: ObservacaoDeId[] = [];

  for (const linha of body.split(/\r?\n/)) {
    const kind = kindDoRotulo(linha);

    if (kind) {
      const vizinho = textoVizinho(linha) || null;

      for (const m of linha.matchAll(ROLE_MENTION_RE)) {
        achados.push({ discordId: m[1], sourceType: 'role', kind, textoVizinho: vizinho });
      }
      for (const m of linha.matchAll(EMOJI_MENTION_RE)) {
        // Emoji sob rótulo de dado (não capitular): mesmo tratamento da role.
        achados.push({ discordId: m[1], sourceType: 'emoji', kind, textoVizinho: vizinho });
      }
      continue;
    }

    // CAPITULAR: emoji colado à palavra seguinte, em linha SEM rótulo — `<:e:1>ra uma
    // vez`. Sem este ramo o `kind: 'letter'` era inalcançável: nada o produzia, então o
    // emoji nunca chegava à fila de revisão e a normalização seguia comendo a inicial
    // do parágrafo. Achado do Codex (P2).
    for (const m of linha.matchAll(CAPITULAR_RE)) {
      achados.push({
        discordId: m[1],
        sourceType: 'emoji',
        kind: 'letter',
        // A palavra que o emoji inicia é a evidência: com "ra uma vez" à vista, o
        // revisor deduz que a letra é "E". É a única pista que o export oferece.
        textoVizinho: m[2] ? m[2].slice(0, 40) : null,
      });
    }
  }

  return achados;
}

/**
 * Registra o que foi observado, sem decidir nada.
 *
 * `occurrences` acumula: uma co-ocorrência pode ser acidente (a role estava na
 * linha por outro motivo), três em anúncios diferentes é padrão. A tela de
 * revisão ordena por isso, então o mantenedor resolve primeiro o que mais
 * aparece — medido: 4 roles concentram 89 das ocorrências em 2 servidores.
 *
 * Nunca sobrescreve `kind` nem alvo de vínculo já CONFIRMADO: o humano decidiu,
 * e uma observação nova não desfaz decisão. Só atualiza a evidência e o contador.
 */
export async function registrarObservacoes(
  guildId: string | null,
  observacoes: ObservacaoDeId[],
): Promise<void> {
  if (!guildId || observacoes.length === 0) return;

  // Um id pode aparecer várias vezes na mesma mensagem; conta uma.
  const unicos = new Map<string, ObservacaoDeId>();
  for (const o of observacoes) unicos.set(`${o.sourceType}:${o.discordId}`, o);

  const agora = new Date();
  for (const o of unicos.values()) {
    await db
      .insertInto('discord_role_mappings')
      .values({
        guild_id: guildId,
        discord_id: o.discordId,
        source_type: o.sourceType,
        kind: o.kind,
        target_system_id: null,
        target_text: null,
        source: 'inferred',
        occurrences: 1,
        last_seen_text: o.textoVizinho,
        last_seen_at: agora,
      })
      .onConflict((oc) =>
        oc.columns(['guild_id', 'discord_id']).doUpdateSet((eb) => ({
          occurrences: eb('discord_role_mappings.occurrences', '+', 1),
          last_seen_text: o.textoVizinho ?? eb.ref('discord_role_mappings.last_seen_text'),
          last_seen_at: agora,
          updated_at: agora,
          // `kind` só é corrigido enquanto NINGUÉM decidiu — depois disso a observação
          // nova é evidência, não autoridade.
          //
          // A condição é `source <> 'manual'`, não `confirmed_at IS NULL`: `PATCH` com
          // `confirmar: false` devolve a linha para a fila gravando `source='manual'` COM
          // `confirmed_at` nulo. Olhando só a confirmação, a próxima observação
          // sobrescreveria o `kind` que o admin acabou de escolher — e ele veria a
          // correção dele desfeita sozinha, sem aviso. Achado do CodeRabbit.
          kind: eb
            .case()
            .when('discord_role_mappings.source', '<>', 'manual')
            .then(o.kind)
            .else(eb.ref('discord_role_mappings.kind'))
            .end(),
        })),
      )
      .execute();
  }
}

/**
 * Mapeamentos CONFIRMADOS de um servidor, indexados por id.
 *
 * Só confirmados: o parser não consome palpite. O que está inferido e não
 * confirmado existe apenas para aparecer na fila de revisão.
 */
/**
 * Linha do mapeamento com o alvo já RESOLVIDO em texto.
 *
 * `target_system_name` vem do join com `systems`: para `kind='system'` o vínculo é o
 * UUID, e é este campo que dá ao parser o texto a escrever no lugar do id.
 */
export type MapeamentoResolvido = DiscordRoleMapping & { target_system_name?: string | null };

export async function carregarMapeamentos(
  guildId: string | null,
): Promise<Map<string, MapeamentoResolvido>> {
  if (!guildId) return new Map();

  // JOIN com `systems` e não `selectAll` sozinho: para `kind='system'` a constraint
  // `discord_role_mappings_target_coherent` EXIGE `target_text IS NULL` — o vínculo mora
  // em `target_system_id`. Sem trazer o nome do sistema junto, `aplicarMapeamentos` não
  // teria o que escrever no lugar de `<@&id>` e a role continuaria intraduzida, que é
  // justamente o caso que motivou a feature (`Sistema: <@&123>`). Achado do Codex (P1).
  const linhas = await db
    .selectFrom('discord_role_mappings as m')
    .leftJoin('systems as s', 's.id', 'm.target_system_id')
    .selectAll('m')
    .select('s.name as target_system_name')
    .where('m.guild_id', '=', guildId)
    .where('m.confirmed_at', 'is not', null)
    .execute();

  // `Array.isArray` antes de `.map` (AGENTS.md §Normalização): o retorno é dado
  // externo até prova em contrário. Sem a guarda, um driver que devolva outra
  // forma derruba o PARSE inteiro por causa de um recurso opcional — e foi
  // exatamente o que aconteceu quando o mock da suíte não conhecia a tabela.
  if (!Array.isArray(linhas)) return new Map();

  return new Map(linhas.map((l) => [`${l.source_type}:${l.discord_id}`, l]));
}

/**
 * Substitui os ids pelo que eles significam, antes de o parser extrair campos.
 *
 * `Sistema: <@&123>` vira `Sistema: D&D 2024`, e a partir daí toda a extração
 * existente funciona sem saber que houve tradução — inclusive o casamento com o
 * catálogo de sistemas. Id sem mapeamento confirmado é removido, como já era.
 */
/**
 * Texto que um mapeamento representa.
 *
 * A constraint da migration reparte o alvo por tipo: `kind='system'` guarda
 * `target_system_id` (e `target_text` obrigatoriamente NULL); todo o resto guarda
 * `target_text`. Ler só `target_text` deixava a role de sistema sem tradução — o caso
 * central da feature. Achado do Codex (P1).
 */
function textoAlvo(m: MapeamentoResolvido): string | null {
  const bruto = m.kind === 'system' ? m.target_system_name : m.target_text;
  const limpo = bruto?.trim();
  return limpo ? limpo : null;
}

export function aplicarMapeamentos(
  body: string,
  mapa: Map<string, MapeamentoResolvido>,
): string {
  if (mapa.size === 0) return body;

  return body
    .replace(ROLE_MENTION_RE, (todo, id: string) => {
      const m = mapa.get(`role:${id}`);
      const texto = m ? textoAlvo(m) : null;
      return texto ? ` ${texto} ` : todo;
    })
    .replace(EMOJI_MENTION_RE, (todo, id: string) => {
      const m = mapa.get(`emoji:${id}`);
      if (!m) return todo;
      // Capitular: a letra cola na palavra seguinte, sem espaço — `<:e:1>ra`
      // precisa virar "Era", não "E ra".
      // Sem alvo, PRESERVA a menção em vez de apagar (`?? ''` fazia sumir), igual ao
      // ramo de role acima: mapeamento confirmado sem texto é dado faltando, e engolir
      // o emoji tira do parágrafo a inicial que ele carregava. Achado do CodeRabbit.
      if (m.kind === 'letter') return m.target_text?.trim() ? m.target_text : todo;
      const texto = textoAlvo(m);
      return texto ? ` ${texto} ` : todo;
    });
}
