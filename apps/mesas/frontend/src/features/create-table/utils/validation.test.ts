import { describe, expect, it } from 'vitest';
import { DESCRIPTION_MAX_LENGTH, validateStep, validators } from './validation';
import type { FormState } from '../types/createTable.types';

// Só os campos que estes testes exercitam. O restante de FormState não muda o
// resultado de validateStep para os steps 1 e 3, e enumerá-lo aqui faria o
// fixture envelhecer a cada campo novo do formulário.
function makeState(over: { description?: string; slotsTotal?: string } = {}): FormState {
  return {
    form: {
      title: 'Mesa de teste',
      description: over.description ?? 'Uma descrição suficientemente longa.',
      slots_total: over.slotsTotal ?? '4',
    },
    sessions: [{ day_of_week: 'segunda', start_time: '19:00', frequency: 'semanal', sort_order: 0 }],
  } as unknown as FormState;
}

describe('validateStep — cada step valida só o que ele mostra', () => {
  it('não reprova o step Básico por causa das vagas, que ficam no step Sessões', () => {
    // O campo de vagas vive em StepSessions (step 3). Validado no step 1, a
    // tela "Básico" — que só tem título e descrição — exibia "Mínimo 1 vaga" e
    // travava o Continuar sem nada ali para corrigir.
    const semVagas = validateStep(1, makeState({ slotsTotal: '' }));

    expect(semVagas).toEqual([]);
  });

  it('reprova as vagas no step Sessões, onde o campo existe', () => {
    expect(validateStep(3, makeState({ slotsTotal: '' }))).toContain('Número de vagas inválido');
    expect(validateStep(3, makeState({ slotsTotal: '0' }))).toContain('Mínimo 1 vaga');
  });
});

describe('validators.description', () => {
  it('aceita até o limite do backend, que é 5000 e não 2000', () => {
    // Espelha userMarkdownSchema(5000) em backend tableValidators.ts. Um
    // anúncio colado de 3.779 caracteres passava no servidor e era barrado no
    // front, que era mais restritivo que o contrato real.
    expect(DESCRIPTION_MAX_LENGTH).toBe(5000);
    expect(validators.description('a'.repeat(3779))).toBeNull();
    expect(validators.description('a'.repeat(5000))).toBeNull();
  });

  it('reprova acima do limite citando o número certo', () => {
    expect(validators.description('a'.repeat(5001))).toBe('Descrição muito longa (máximo 5000 caracteres)');
  });
});

describe('validators.sessions', () => {
  it('aceita sessão com dia e início, sem horário de término', () => {
    expect(validators.sessions([{
      day_of_week: 'sábado',
      start_time: '19:00',
      frequency: 'semanal',
      is_ongoing: true,
      sort_order: 0,
    }])).toBeNull();
  });
});
