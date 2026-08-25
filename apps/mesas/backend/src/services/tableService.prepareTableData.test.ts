import { TableService } from './tableService.js';
import { createTableSchema } from '../validators/tableValidators.js';

// T4.7 (spec 096, R10): rascunho no backend — a mesa nasce status='draft'
// (default real da coluna, medido em produção: 'draft'::table_status) e
// entra no catálogo só ao publicar. Antes, prepareTableData forçava
// status: 'active', o que tornava o default da coluna inalcançável pelo
// fluxo manual. Este teste fixa o default novo e a preservação do status
// explícito.
const BASE_PAYLOAD = {
  title: 'Mesa de teste',
  system_id: '123e4567-e89b-42d3-a456-426614174000',
  type: 'campanha',
  modality: 'online',
  contacts: [{ channel: 'discord', value: 'mestre' }],
} as const;

function prepare(payload: Record<string, unknown>) {
  const data = createTableSchema.parse(payload);
  return TableService.prepareTableData(data, 'gm-profile-1', null, null, null, 'mesa-teste', 'gm');
}

describe('prepareTableData — status da mesa (T4.7, spec 096)', () => {
  it('create SEM status nasce draft (default real da coluna, não mais forçado para active)', () => {
    const result = prepare({ ...BASE_PAYLOAD });
    expect(result.status).toBe('draft');
  });

  // O create aceitava `status` explícito até 2026-08-25: qualquer mestre
  // autenticado podia mandar 'active' no POST e publicar sem passar pelo
  // PATCH, que é quem grava published_at. Resultado: mesa no catálogo sem
  // âncora de auto-arquivamento (COALESCE(published_at, created_at) cai em
  // created_at e arquiva precocemente mesa que ficou dias em rascunho), sem
  // notificação a admin e sem scrape de OG.
  it('status no payload é rejeitado no parse — publicação só pelo PATCH /gm/tables/:id/status', () => {
    expect(() => prepare({ ...BASE_PAYLOAD, status: 'active' })).toThrow();
    expect(() => prepare({ ...BASE_PAYLOAD, status: 'draft' })).toThrow();
  });
});
