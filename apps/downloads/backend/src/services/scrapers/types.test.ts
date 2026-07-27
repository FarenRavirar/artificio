import { expectTypeOf, it } from 'vitest';
import type { ScrapedItem } from './types';

type IsRequired<T, K extends keyof T> = Record<string, never> extends Pick<T, K> ? false : true;

it('exige veredito explícito para systemHint e materialTypeHint', () => {
  // Spec 089 T0.5: se qualquer campo voltar a ser opcional, o teste de tipo
  // falha durante tsc/vitest. Teste runtime isolado não protegeria o contrato.
  expectTypeOf<IsRequired<ScrapedItem, 'systemHint'>>().toEqualTypeOf<true>();
  expectTypeOf<IsRequired<ScrapedItem, 'materialTypeHint'>>().toEqualTypeOf<true>();
});
