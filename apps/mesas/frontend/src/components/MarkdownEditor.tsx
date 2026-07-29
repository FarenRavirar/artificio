import { ContentEditor } from '@artificio/content-editor';

interface MarkdownEditorProps {
  value: string;
  onChange: (text: string) => void;
  label?: string;
  placeholder?: string;
  height?: number;
  id?: string;
  maxLength?: number;
  disabled?: boolean;
}

/**
 * Adaptador temporário para os formulários existentes do mesas.
 * Implementação, renderer e contrato vivem em @artificio/content-editor.
 */
export function MarkdownEditor({
  value,
  onChange,
  label = 'Conteúdo',
  placeholder,
  height,
  id,
  maxLength,
  disabled,
}: Readonly<MarkdownEditorProps>) {
  return (
    <ContentEditor
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      minHeight={height}
      id={id}
      maxLength={maxLength}
      disabled={disabled}
    />
  );
}
