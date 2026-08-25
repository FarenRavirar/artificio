import type { TableEditorState } from '../types';
import { mapApiToEditorState } from './editorMapping';

/**
 * Aplica a prévia do parser SOBRE o estado atual, campo a campo.
 *
 * "Colar anúncio" pode ser usado com o formulário já preenchido, e o parser
 * reconhece só parte dos campos. Substituir o estado inteiro (o que este editor
 * fazia) apagava em silêncio título, contato, banner e configuração que o
 * mestre tinha digitado e o parser não extraiu.
 *
 * O que torna o caso traiçoeiro: `mapApiToEditorState` preenche TODA chave do
 * estado, então nada chega `undefined` e um spread cru sobrescreveria tudo do
 * mesmo jeito. E "descartar valor vazio" também não basta — o mapper emite
 * DEFAULTS não-vazios ('gratuita', 'campanha', 'online', '4'), que rebaixariam
 * uma mesa que o mestre marcou como paga.
 *
 * A única fonte que sabe o que o parser reconheceu é o objeto CRU da resposta
 * (`data.table` só carrega as chaves extraídas). Daí a sondagem: cada chave da
 * fonte é substituída por um valor de teste, e os campos do estado que mudam
 * são os que aquela chave alimenta.
 */
export function buildStateFromPreview(
  rawPreviewData: unknown,
  current: TableEditorState,
): TableEditorState {
  const preview = mapApiToEditorState(rawPreviewData);
  // Quais campos do estado a FONTE produziu (e não o mapper por default).
  //
  // Comparar com o mapeamento de uma fonte vazia (a versão anterior) confundia
  // "o parser achou 'gratuita'" com "o mapper preencheu 'gratuita' por default":
  // o valor é o mesmo, mas só o primeiro deve sobrescrever o formulário. A
  // sondagem também dispensa mapear chave-fonte → campo do estado à mão,
  // relação que não é 1:1 (`banner_url`/`image_url` → `bannerUrl`; `schedules` +
  // `schedule_day_status` → `schedules` + `isPersonalizedSchedule`).
  const extractedKeys = extractedStateKeys(rawPreviewData, preview);

  const merged: TableEditorState = { ...current };

  for (const key of extractedKeys) {
    const incoming = (preview as Record<string, unknown>)[key];
    const currentValue = (current as unknown as Record<string, unknown>)[key];

    // `ddal` é objeto e vem sempre completo: mesclar campo a campo evita que um
    // bloco inteiro de defaults apague o DDAL que o mestre já tinha marcado.
    if (isPlainObject(incoming) && isPlainObject(currentValue)) {
      (merged as unknown as Record<string, unknown>)[key] = mergeExtracted(currentValue, incoming);
      continue;
    }

    (merged as unknown as Record<string, unknown>)[key] = incoming;
  }

  return merged;
}

/**
 * Campos do estado que a fonte de fato produziu.
 *
 * Para cada chave da fonte crua, remapeia a fonte com aquela chave trocada por
 * um valor de teste: os campos do estado que mudam são os que ela alimenta.
 * Chave ausente na fonte não sonda nada, então o que o mapper preenche sozinho
 * (string vazia, `false`, defaults como 'gratuita'/'campanha') fica de fora — e
 * um 'gratuita' que o parser realmente extraiu entra.
 */
function extractedStateKeys(
  rawPreviewData: unknown,
  preview: ReturnType<typeof mapApiToEditorState>,
): (keyof TableEditorState)[] {
  if (!isPlainObject(rawPreviewData)) return [];

  const previewRecord = preview as Record<string, unknown>;
  const extracted = new Set<string>();

  for (const sourceKey of Object.keys(rawPreviewData)) {
    // Sondagem no lugar do valor real: revela QUAIS campos do estado aquela
    // chave alimenta, mesmo quando o valor que ela traz coincide com o default
    // do mapper. Só remover a chave não bastava — `price_type: 'gratuita'`
    // produz 'gratuita' com ou sem ela, e o campo ficava de fora.
    //
    // Mais de uma sondagem porque uma só não basta: campos normalizados para um
    // domínio pequeno colapsam valores inválidos no default (medido:
    // `normalizePriceType` devolve 'gratuita' para tudo que não é 'paga'), e a
    // sondagem passaria despercebida. Basta UMA delas mudar o campo para provar
    // que a chave o alimenta.
    for (const probe of PROBES) {
      const probed = mapApiToEditorState({ ...rawPreviewData, [sourceKey]: probe }) as Record<
        string,
        unknown
      >;

      for (const stateKey of Object.keys(previewRecord)) {
        if (!deepEqual(previewRecord[stateKey], probed[stateKey])) {
          extracted.add(stateKey);
        }
      }
    }
  }

  return [...extracted] as (keyof TableEditorState)[];
}

/**
 * Valores usados para sondar qual campo do estado cada chave da fonte alimenta.
 *
 * Nenhum precisa ser valido: o que importa e que ao menos um produza saida
 * DIFERENTE do valor real quando a chave e lida. A string improvavel cobre o
 * caso geral; 'paga' e `true` cobrem os campos cuja normalizacao colapsa
 * qualquer entrada invalida no default (normalizePriceType, booleanValue),
 * onde a string sozinha seria indistinguivel.
 */
const PROBES: unknown[] = ['__probe_sentinel__', 'paga', true];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Igualdade estrutural — os campos comparados são JSON puro (sem Date/Map). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Mesma regra do merge de topo, um nível abaixo (usado pelo bloco `ddal`). */
function mergeExtracted(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    // Dentro do bloco só entra o que tem conteúdo: o objeto chega completo,
    // com string vazia nos campos que o parser não achou.
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (value === false) continue;
    merged[key] = value;
  }
  return merged;
}

/**
 * Fase 6 (spec 096, T6.2): aplica a prévia e devolve TAMBÉM quais campos do
 * estado a fonte produziu — é a marca visual do R5 ("campo preenchido pelo
 * parser é visualmente distinto e diz de onde veio"). Os sinais de
 * ambiguidade não passam por aqui: são lidos do objeto cru por
 * `parseParserSignals` (utils/parserSignals.ts), que conhece as chaves `_*`.
 *
 * O custo é um segundo mapeamento da fonte (buildStateFromPreview já mapeia
 * uma vez): objeto de ~50 chaves, desprezível frente ao valor da marca.
 */
export function applyParserPreview(
  rawPreviewData: unknown,
  current: TableEditorState,
): { state: TableEditorState; extractedFields: (keyof TableEditorState)[] } {
  const preview = mapApiToEditorState(rawPreviewData);
  return {
    state: buildStateFromPreview(rawPreviewData, current),
    extractedFields: extractedStateKeys(rawPreviewData, preview),
  };
}
