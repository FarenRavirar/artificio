import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

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
}: UseUrlStateConfig<T>): readonly [T, (value: T | ((prev: T) => T)) => void] {
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

  // Setter com updater function (padrão React)
  // Aceita valor direto ou função updater
  const setState = (value: T | ((prev: T) => T)) => {
    const nextState = typeof value === 'function' 
      ? (value as (prev: T) => T)(state)
      : value;
    const params = serialize(nextState);
    setSearchParams(params, { replace: true });
  };

  return [state, setState] as const;
}
