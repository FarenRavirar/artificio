import { describe, expect, it } from 'vitest';
import { validateDisplayName, validateUsername } from './profileFieldRules';

describe('profileFieldRules — mesmo contrato do servidor', () => {
  it('nome de exibição: piso de 2 caracteres, espaços não contam', () => {
    expect(validateDisplayName('V')).not.toBeNull();
    expect(validateDisplayName('  V ')).not.toBeNull();
    expect(validateDisplayName('VOID')).toBeNull();
  });

  it('username: piso de 3 e só letras, números e underscore', () => {
    expect(validateUsername('vo')).not.toBeNull();
    expect(validateUsername('vo id')).not.toBeNull();
    expect(validateUsername('vo-id')).not.toBeNull();
    expect(validateUsername('void_1')).toBeNull();
  });
});
