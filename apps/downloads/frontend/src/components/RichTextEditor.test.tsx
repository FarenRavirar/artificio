import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichTextEditor } from './RichTextEditor';

// ProseMirror consulta geometria de seleção; jsdom não implementa layout.
// Stubs neutros permitem exercitar comandos/HTML sem fingir coordenadas reais.
beforeAll(() => {
  const emptyRect = { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.body });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => emptyRect });
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', { configurable: true, value: () => [] });
});

describe('RichTextEditor', () => {
  it('carrega conteúdo inicial', async () => {
    render(<RichTextEditor value="<p>Descrição <strong>inicial</strong></p>" onChange={vi.fn()} />);

    const editor = await screen.findByRole('textbox', { name: 'Descrição rica' });
    expect(editor).toHaveTextContent('Descrição inicial');
    expect(editor.querySelector('strong')).toHaveTextContent('inicial');
  });

  it('toolbar aplica marca de negrito', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} />);

    const editor = await screen.findByRole('textbox', { name: 'Descrição rica' });
    await user.click(editor);
    await user.click(screen.getByRole('button', { name: 'Negrito' }));
    await user.type(editor, 'forte');

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<strong>forte</strong>')));
  });

  it('onChange emite HTML editado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} />);

    const editor = await screen.findByRole('textbox', { name: 'Descrição rica' });
    await user.click(editor);
    await user.type(editor, 'Novo conteúdo');

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<p>Novo conteúdo</p>'));
  });
});
