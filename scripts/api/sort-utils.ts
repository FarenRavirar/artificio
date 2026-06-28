/**
 * Comparadores de ordenação para artefatos determinísticos da governança de API.
 *
 * `Array.prototype.sort()` sem comparador ordena por UTF-16 (e converte para
 * string implicitamente), o que é frágil e foi sinalizado pelo SonarCloud.
 * Use estes helpers para ordenação estável e explícita por locale.
 */

/** Ordena strings por locale. */
export const byLocale = (a: string, b: string): number => a.localeCompare(b);

/** Ordena entries `[chave, valor]` pela chave string, por locale. */
export const byEntryKey = <V>([a]: [string, V], [b]: [string, V]): number => a.localeCompare(b);
