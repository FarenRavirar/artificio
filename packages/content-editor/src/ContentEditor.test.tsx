import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ContentEditor, renderMarkdown } from './ContentEditor.js';

function EditorHarness() {
  const [value, setValue] = useState('');
  return <ContentEditor value={value} onChange={setValue} label="Descrição" />;
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
});
