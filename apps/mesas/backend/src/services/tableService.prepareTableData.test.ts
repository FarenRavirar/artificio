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

  it('create COM status explícito draft persiste draft', () => {
    const result = prepare({ ...BASE_PAYLOAD, status: 'draft' });
    expect(result.status).toBe('draft');
  });

  it('create COM status explícito active continua permitido (publica direto)', () => {
    const result = prepare({ ...BASE_PAYLOAD, status: 'active' });
    expect(result.status).toBe('active');
  });

  it('status fora do enum real da coluna é rejeitado no parse (pg_enum: draft|active|full|cancelled|ended|pending_review)', () => {
    expect(() => prepare({ ...BASE_PAYLOAD, status: 'publicado' })).toThrow();
  });
});
