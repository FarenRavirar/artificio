import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommitTextField } from './CommitTextField';
import { validateUsername } from '../utils/profileFieldRules';

function setup(initialValue = '') {
  const onCommit = vi.fn();
  render(
    <CommitTextField
      id="username"
      label="Username"
      hint="dica"
      initialValue={initialValue}
      validate={validateUsername}
      onCommit={onCommit}
    />,
  );
  return { onCommit, input: screen.getByLabelText('Username') };
}

describe('CommitTextField (spec 106 R6)', () => {
  it('digitar tecla a tecla não grava nada até sair do campo', () => {
    const { onCommit, input } = setup();
    for (const v of ['v', 'vo', 'voi', 'void']) fireEvent.change(input, { target: { value: v } });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('void');
  });

  it('valor inválido mostra o erro no campo e não grava', () => {
    const { onCommit, input } = setup();
    fireEvent.change(input, { target: { value: 'vo' } });
    fireEvent.blur(input);

    expect(screen.getByText('Use pelo menos 3 caracteres.')).toBeTruthy();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Enter grava', () => {
    const { onCommit, input } = setup();
    fireEvent.change(input, { target: { value: 'void' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('void');
  });

  it('sair sem mudar não valida nem grava (username novo começa vazio)', () => {
    const { onCommit, input } = setup('');
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByText('Use pelo menos 3 caracteres.')).toBeNull();
  });

  it('recusa do servidor (username em uso) aparece no campo', async () => {
    const onCommit = vi.fn().mockResolvedValue('Username já está em uso');
    render(
      <CommitTextField id="username" label="Username" hint="dica" initialValue=""
        validate={validateUsername} onCommit={onCommit} />,
    );
    const input = screen.getByLabelText('Username');
    fireEvent.change(input, { target: { value: 'void' } });
    fireEvent.blur(input);

    expect(await screen.findByText('Username já está em uso')).toBeTruthy();
  });
});
