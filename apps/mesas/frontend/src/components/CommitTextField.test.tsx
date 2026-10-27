import { act, fireEvent, render, screen } from '@testing-library/react';
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

  // Achado do Codex (PR #341): a resposta de uma gravação antiga não pode
  // determinar o estado do valor atual.
  it('erro de uma gravação antiga não sobrevive ao sucesso da gravação mais nova', async () => {
    let falharPrimeira: (msg: string) => void = () => {};
    const onCommit = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => { falharPrimeira = resolve; }))
      .mockResolvedValueOnce(null);
    render(
      <CommitTextField id="username" label="Username" hint="dica" initialValue=""
        validate={validateUsername} onCommit={onCommit} />,
    );
    const input = screen.getByLabelText('Username');

    fireEvent.change(input, { target: { value: 'ocupado' } });
    fireEvent.blur(input);                                   // 1ª: ficará em voo
    fireEvent.change(input, { target: { value: 'livre_1' } });
    fireEvent.blur(input);                                   // 2ª: ok
    await act(async () => { await Promise.resolve(); });

    await act(async () => { falharPrimeira('Username já está em uso'); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByText('Username já está em uso')).toBeNull();
  });

  // Achado do Codex (PR #341): com gravação em voo, `initialValue` já reflete o cache
  // otimista, não a última escrita pedida; voltar a esse valor não pode ser tido como "sem mudança".
  it('voltar ao valor otimista depois de enfileirar outro ainda regrava o último', async () => {
    const onCommit = vi.fn().mockImplementation(() => new Promise<string | null>(() => {})); // sempre em voo
    const props = { id: 'display_name', label: 'Nome', hint: 'dica', validate: (v: string) => (v.length < 2 ? 'curto' : null), onCommit };
    const { rerender } = render(<CommitTextField {...props} initialValue="nome_a" />);
    const input = screen.getByLabelText('Nome');

    fireEvent.change(input, { target: { value: 'nome_b' } });
    fireEvent.blur(input);                                   // 1ª: b em voo
    rerender(<CommitTextField {...props} initialValue="nome_b" />); // cache otimista = b
    fireEvent.change(input, { target: { value: 'nome_c' } });
    fireEvent.blur(input);                                   // 2ª: c fica na fila
    fireEvent.change(input, { target: { value: 'nome_b' } });
    fireEvent.blur(input);                                   // 3ª: volta a b — precisa substituir c

    expect(onCommit).toHaveBeenCalledTimes(3);
    expect(onCommit).toHaveBeenLastCalledWith('nome_b');
  });
});
