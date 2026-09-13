// Contrato de domínio de mesa — a fonte única é `@artificio/catalog-table`
// (spec 102 T4.2). Os tipos subiram para o pacote porque o SSR precisa deles no
// servidor, e duplicá-los aqui deixaria as duas pontas divergirem em silêncio.
//
// Este arquivo permanece como re-export para não reescrever os 46 imports que
// já apontam para cá; `TablesResponse` fica local por ser paginação de API,
// não domínio de mesa.
export * from '@artificio/catalog-table';
export type { TableCard } from '@artificio/catalog-table';

import type { TableCard } from '@artificio/catalog-table';

export interface TablesResponse {
  data: TableCard[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
    total?: number; // CORREÇÃO DT-05: Total de mesas ativas
  };
}
