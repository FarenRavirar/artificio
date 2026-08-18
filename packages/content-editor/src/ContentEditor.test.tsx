import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ContentEditor, contentCountLabel, contentOverflow, renderMarkdown } from './ContentEditor.js';

function EditorHarness() {
  const [value, setValue] = useState('');
  return <ContentEditor value={value} onChange={setValue} label="Descrição" />;
}

function LimitedHarness({ initial = '', max = 10 }: { readonly initial?: string; readonly max?: number }) {
  const [value, setValue] = useState(initial);
  return <ContentEditor value={value} onChange={setValue} label="Descrição" maxLength={max} />;
}

describe('ContentEditor', () => {
  it('edita Markdown e alterna para prévia sanitizada', () => {
    render(<EditorHarness />);

    const editor = screen.getByRole('textbox', { name: 'Descrição' });
    fireEvent.change(editor, { target: { value: '**seguro** <script>alert(1)</script>' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));

    expect(screen.getByRole('tabpanel', { name: 'Prévia de Descrição' }).textContent).toContain('seguro <script>alert(1)</script>');
    expect(document.querySelector('script')).toBeNull();
  });

  it('toolbar aplica Markdown ao texto selecionado', () => {
    const onChange = vi.fn();
    render(<ContentEditor value="forte" onChange={onChange} label="Comentário" />);

    const editor = screen.getByRole('textbox', { name: 'Comentário' }) as HTMLTextAreaElement;
    editor.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole('button', { name: 'Negrito' }));

    expect(onChange).toHaveBeenCalledWith('**forte**');
  });

  it('prefixa a linha inteira quando o cursor está no meio dela e não há seleção', () => {
    const onChange = vi.fn();
    render(<ContentEditor value="parágrafo" onChange={onChange} label="Comentário" />);

    const editor = screen.getByRole('textbox', { name: 'Comentário' }) as HTMLTextAreaElement;
    editor.setSelectionRange(6, 6);
    fireEvent.click(screen.getByRole('button', { name: 'Inserir título nível 2' }));

    expect(onChange).toHaveBeenCalledWith('## parágrafo');
  });

  it('prefixa apenas a linha do cursor em texto multilinha', () => {
    const onChange = vi.fn();
    render(<ContentEditor value={'primeira\nsegunda\nterceira'} onChange={onChange} label="Comentário" />);

    const editor = screen.getByRole('textbox', { name: 'Comentário' }) as HTMLTextAreaElement;
    const cursor = 'primeira\nseg'.length;
    editor.setSelectionRange(cursor, cursor);
    fireEvent.click(screen.getByRole('button', { name: 'Lista com marcadores' }));

    expect(onChange).toHaveBeenCalledWith('primeira\n- segunda\nterceira');
  });

  it('labelledByExternal omite o aria-label para o <label> visível do consumidor nomear o campo', () => {
    render(
      <>
        <label htmlFor="campo-externo">Mensagem visível</label>
        <ContentEditor id="campo-externo" value="" onChange={vi.fn()} label="Mensagem" labelledByExternal />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Mensagem visível' })).toBeDefined();
  });

  it('mantém o textarea required montado durante a prévia para não perder a validação nativa', () => {
    render(<ContentEditor value="conteúdo" onChange={vi.fn()} label="Mensagem" required />);

    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));

    const editor = screen.getByRole('textbox', { name: 'Mensagem', hidden: true }) as HTMLTextAreaElement;
    expect(editor.isConnected).toBe(true);
    expect(editor.required).toBe(true);
    expect(editor.disabled).toBe(false);
    // Montado e validável, mas fora da ordem de tabulação enquanto oculto.
    expect(editor.tabIndex).toBe(-1);

    for (const tool of screen.getAllByRole('button', { hidden: true })) {
      if (tool.classList.contains('artificio-content-editor__tool')) {
        expect(tool.tabIndex).toBe(-1);
      }
    }
  });

  it('bloqueia o submit nativo quando o campo required está vazio na prévia', () => {
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <ContentEditor value="" onChange={vi.fn()} label="Mensagem" required />
        <button type="submit">Enviar</button>
      </form>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Prévia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
  // O limite é AVISO, nunca trava (pedido do mantenedor, 2026-08-18). Estes
  // testes existem porque o comportamento anterior — truncar em silêncio — era
  // indistinguível de "funcionou" na tela: o texto colado sumia sem erro.
  it('conta quanto FALTA, não quanto foi usado', () => {
    render(<LimitedHarness initial="abc" max={10} />);

    expect(screen.getByText('Faltam 7 de 10').isConnected).toBe(true);
  });

  it('aceita texto acima do limite e informa o excesso em vez de truncar', () => {
    render(<LimitedHarness max={10} />);
    const campo = screen.getByRole('textbox');

    fireEvent.change(campo, { target: { value: 'a'.repeat(13) } });

    // O valor inteiro é preservado: o usuário corta o que quiser, o campo não
    // decide por ele qual pedaço do texto dele vale menos.
    expect((campo as HTMLTextAreaElement).value).toBe('a'.repeat(13));
    expect(screen.getByText('3 caracteres acima do limite').isConnected).toBe(true);
  });

  it('marca visualmente só o trecho que passou do limite', () => {
    const { container } = render(<LimitedHarness initial={`${'a'.repeat(10)}bbb`} max={10} />);

    const excesso = container.querySelector('.artificio-content-editor__overflow');
    expect(excesso?.textContent).toBe('bbb');
  });

  it('singulariza a mensagem quando o excesso é de um caractere só', () => {
    render(<LimitedHarness initial={'a'.repeat(11)} max={10} />);

    expect(screen.getByText('1 caractere acima do limite').isConnected).toBe(true);
  });

  it('não deixa o browser truncar a colagem: o textarea não usa maxLength nativo', () => {
    render(<LimitedHarness max={10} />);

    expect(screen.getByRole('textbox').hasAttribute('maxlength')).toBe(false);
  });

  it('acompanha o scroll do textarea com o espelho do excesso', () => {
    // Texto acima do limite passa da altura do campo: sem sincronizar, o
    // espelho ficaria no topo enquanto o caret está no meio, e a marca do
    // excesso escorregaria para longe do texto que ela marca (achado P2 do
    // Codex, PR #275).
    const { container } = render(<LimitedHarness initial={'linha\n'.repeat(40)} max={10} />);
    const campo = screen.getByRole('textbox');
    const espelho = container.querySelector('.artificio-content-editor__mirror') as HTMLElement;

    campo.scrollTop = 120;
    fireEvent.scroll(campo);

    expect(espelho.scrollTop).toBe(120);
  });

  it('barra o submit nativo acima do limite, sem o formulário precisar conferir', () => {
    // Este é o piso que dispensa adaptar consumidor a consumidor: o form
    // abaixo NÃO checa tamanho nenhum, e mesmo assim não submete. Adaptar tela
    // a tela já falhou uma vez — cobri 8 e deixei 13 passando (achado P1 do
    // Codex, PR #275, segunda rodada).
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <ContentEditor value={'a'.repeat(13)} onChange={vi.fn()} label="Mensagem" maxLength={10} />
        <button type="submit">Enviar</button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).validationMessage).toBe(
      'Reduza 3 caracteres: o limite é 10.',
    );
  });

  it('libera o submit assim que o texto volta para dentro do limite', () => {
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <ContentEditor value="curto" onChange={vi.fn()} label="Mensagem" maxLength={10} />
        <button type="submit">Enviar</button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('posiciona o espelho já na primeira vez que o excesso aparece', () => {
    // Transição de 0 para positivo: o espelho nasce DEPOIS do onChange que o
    // criou, então sincronizar só no handler o deixaria no topo enquanto o
    // textarea já está rolado (achado de review, PR #275).
    const { container } = render(<LimitedHarness max={10} />);
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;

    expect(container.querySelector('.artificio-content-editor__mirror')).toBeNull();

    campo.scrollTop = 90;
    fireEvent.change(campo, { target: { value: 'linha\n'.repeat(40) } });

    const espelho = container.querySelector('.artificio-content-editor__mirror') as HTMLElement;
    expect(espelho).not.toBeNull();
    expect(espelho.scrollTop).toBe(90);
  });

  it('mantém os comandos da toolbar funcionando acima do limite', () => {
    render(<LimitedHarness initial={'a'.repeat(12)} max={10} />);

    // Antes, `replaceSelection`/`prefixLines` faziam `return` mudo perto do
    // limite: o botão parecia quebrado, sem nenhuma mensagem explicando.
    fireEvent.click(screen.getByRole('button', { name: 'Negrito' }));

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(`**texto em negrito**${'a'.repeat(12)}`);
  });
});

describe('contentOverflow', () => {
  // Contrato que os consumidores usam para barrar o submit: o editor deixou de
  // truncar, então sem isto o excesso chegaria ao backend como 400 genérico
  // (achado P1 do Codex, PR #275).
  it('devolve 0 dentro do limite e a diferença acima dele', () => {
    expect(contentOverflow('abc', 10)).toBe(0);
    expect(contentOverflow('a'.repeat(10), 10)).toBe(0);
    expect(contentOverflow('a'.repeat(13), 10)).toBe(3);
  });

  it('devolve 0 quando não há limite definido', () => {
    expect(contentOverflow('a'.repeat(9999))).toBe(0);
  });
});

describe('contentCountLabel', () => {
  it('diz quanto falta enquanto há folga e quanto passou depois do limite', () => {
    expect(contentCountLabel('abc', 10)).toBe('Faltam 7 de 10');
    expect(contentCountLabel('a'.repeat(13), 10)).toBe('3 caracteres acima do limite');
  });

  it('singulariza o excesso de um caractere', () => {
    expect(contentCountLabel('a'.repeat(11), 10)).toBe('1 caractere acima do limite');
  });
});

describe('renderMarkdown', () => {
  it('renderiza recursos GFM disponíveis sem aceitar HTML cru ou protocolo executável', () => {
    const output = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n\n~~fim~~ [x](javascript:alert(1))');

    expect(output).toContain('<table>');
    expect(output).toContain('<s>fim</s>');
    expect(output).not.toMatch(/href="javascript:|<script/i);
  });

  it('renderiza task lists GFM como checkboxes desabilitados', () => {
    const output = renderMarkdown('- [x] Feito\n- [ ] Pendente');

    expect(output).toContain('<input type="checkbox" disabled="" checked="">');
    expect(output).toContain('<input type="checkbox" disabled="">');
  });

  it('renderiza checkboxes também em lista solta, onde o item vem embrulhado em <p>', () => {
    const output = renderMarkdown('- [x] Feito\n\n- [ ] Pendente');

    expect(output).toContain('<input type="checkbox" disabled="" checked="">');
    expect(output).toContain('<input type="checkbox" disabled="">');
    expect(output).not.toMatch(/\[[ xX]\]/);
  });
});
