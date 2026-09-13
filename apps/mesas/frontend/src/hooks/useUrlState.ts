import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Configuração do hook useUrlState
 */
export interface UseUrlStateConfig<T> {
  /**
   * Parser: converte URLSearchParams para estado tipado
   * Deve validar e normalizar entrada
   */
  parse: (params: URLSearchParams) => T;
  
  /**
   * Serializer: converte estado tipado para URLSearchParams
   * Deve omitir defaults e garantir ordem consistente
   */
  serialize: (state: T) => URLSearchParams;
}

export type UrlStateSetter<T> = (
  value: T | ((prev: T) => T),
  options?: Readonly<{ replace?: boolean }>,
) => void;

/**
 * Hook genérico para sincronizar estado com URL
 * 
 * Características:
 * - URL como fonte única de verdade
 * - Normalização automática (corrige URLs inválidas)
 * - Setter determinístico (sempre mesma ordem)
 * - Proteção anti-loop com useRef
 * - Updater function para atualizações seguras
 * 
 * @example
 * ```ts
 * const [filters, setFilters] = useUrlState({
 *   parse: parseFilters,
 *   serialize: buildParams
 * });
 * 
 * // Atualização segura
 * setFilters(prev => ({ ...prev, page: prev.page + 1 }));
 * ```
 */
export function useUrlState<T>({
  parse,
  serialize,
}: UseUrlStateConfig<T>): readonly [T, UrlStateSetter<T>] {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Ref para prevenir loops de normalização
  const lastNormalizedRef = useRef<string | null>(null);

  // Dev warnings (apenas em desenvolvimento)
  if (import.meta.env.DEV) {
    if (!parse || typeof parse !== 'function') {
      console.warn('[useUrlState] parse function is required and must be a function');
    }
    if (!serialize || typeof serialize !== 'function') {
      console.warn('[useUrlState] serialize function is required and must be a function');
    }
  }

  // Estado derivado da URL (memoizado)
  const state = useMemo(() => parse(searchParams), [searchParams, parse]);

  // String normalizada memoizada (evita recalcular serialize)
  const normalizedString = useMemo(
    () => serialize(state).toString(),
    [state, serialize]
  );

  // Normalização automática da URL
  // Se parser corrigiu valores inválidos, atualiza a URL silenciosamente
  useEffect(() => {
    // Se já normalizamos para este valor, não fazer nada
    if (lastNormalizedRef.current === normalizedString) return;

    // Se URL atual difere da normalizada, corrigir silenciosamente
    const currentString = searchParams.toString();
    if (currentString !== normalizedString) {
      lastNormalizedRef.current = normalizedString;
      setSearchParams(new URLSearchParams(normalizedString), { replace: true });
    }
  }, [normalizedString, searchParams, setSearchParams]); // Usa normalizedString memoizado

  // Ações explícitas criam histórico por padrão. Atualizações técnicas podem
  // optar por replace; a normalização silenciosa acima sempre substitui.
  //
  // `pendingRef` encadeia chamadas dentro do mesmo tick (spec 102 T4.2). Trocar
  // `experience` e `type` seguidos no painel avançado produzia só o segundo
  // filtro: ambas as chamadas liam o mesmo estado e a segunda sobrescrevia a
  // primeira. Medido com sonda no serialize — o updater do `setSearchParams` do
  // React Router v7 **não** encadeia no mesmo tick: a segunda chamada recebe
  // `prev` ainda vazio, não o resultado pendente da primeira. Com `MemoryRouter`
  // a navegação era síncrona e escondia a corrida; o router de dados do framework
  // mode navega de forma assíncrona e a expôs.
  //
  // O pendente é descartado assim que a URL alcança o valor que ele previa, para
  // que a próxima ação parta do estado real e não de um encadeamento obsoleto.
  //
  // É `useState` e não `useRef`: ler e escrever um ref durante o render quebra o
  // contrato de pureza do React (`react-hooks/refs`) e, com renderização
  // concorrente, o valor lido pode ser de uma passagem descartada. O padrão
  // suportado para "ajustar estado quando uma prop derivada muda" é comparar
  // durante o render e chamar o setter, que o React trata reiniciando o render
  // antes de pintar — nunca um efeito, que só rodaria depois da pintura.
  const [pending, setPending] = useState<{ serialized: string; state: T } | null>(null);

  const currentSerialized = searchParams.toString();
  const activePending = pending && pending.serialized !== currentSerialized ? pending : null;

  if (pending && pending.serialized === currentSerialized) {
    setPending(null);
  }

  const setState: UrlStateSetter<T> = (value, options) => {
    const baseState = activePending?.state ?? state;
    const nextState = typeof value === 'function'
      ? (value as (prev: T) => T)(baseState)
      : value;
    const params = serialize(nextState);
    setPending({ serialized: params.toString(), state: nextState });
    setSearchParams(params, { replace: options?.replace ?? false });
  };

  return [state, setState] as const;
}
