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
 * (`data.table` só carrega as chaves extraídas). Por isso a comparação é feita
 * contra o mapeamento de um objeto vazio: o que difere dele veio do texto
 * colado; o que for igual é default do mapper e não toca no formulário.
 */
export function buildStateFromPreview(
  rawPreviewData: unknown,
  current: TableEditorState,
): TableEditorState {
  const preview = mapApiToEditorState(rawPreviewData);
  // Mapeamento de uma fonte VAZIA: a linha de base de tudo que o mapper inventa
  // sozinho (string vazia, array vazio, false e os defaults nomeados acima).
  const baseline = mapApiToEditorState({});

  const merged: TableEditorState = { ...current };

  for (const key of Object.keys(preview) as (keyof TableEditorState)[]) {
    const incoming = (preview as Record<string, unknown>)[key];
    const baseValue = (baseline as Record<string, unknown>)[key];
    const currentValue = (current as unknown as Record<string, unknown>)[key];

    // `ddal` é objeto e vem sempre completo: mesclar campo a campo evita que um
    // bloco inteiro de defaults apague o DDAL que o mestre já tinha marcado.
    if (isPlainObject(incoming) && isPlainObject(currentValue)) {
      (merged as unknown as Record<string, unknown>)[key] = mergeExtracted(
        currentValue,
        incoming,
        isPlainObject(baseValue) ? baseValue : {},
      );
      continue;
    }

    if (!wasExtracted(incoming, baseValue)) continue;
    (merged as unknown as Record<string, unknown>)[key] = incoming;
  }

  return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Mesma regra do merge de topo, um nível abaixo (usado pelo bloco `ddal`). */
function mergeExtracted(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
  baseline: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (!wasExtracted(value, baseline[key])) continue;
    merged[key] = value;
  }
  return merged;
}

/**
 * O parser extraiu este campo, ou é o mapper preenchendo sozinho?
 *
 * Igual à linha de base = o mapper produziria esse mesmo valor a partir de uma
 * fonte vazia, logo não houve extração. Vale para string vazia, array vazio,
 * `false` e para os defaults nomeados ('gratuita', 'campanha', 'online', '4').
 */
function wasExtracted(value: unknown, baseline: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return !Object.is(value, baseline);
}
