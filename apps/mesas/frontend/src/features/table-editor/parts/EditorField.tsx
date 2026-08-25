import type { ReactNode } from 'react';
import { Button, Field } from '@artificio/ui';
import type { TableEditorState } from '../types';
import { fieldLevel, RECOMMENDED_GAIN } from '../utils/editorValidation';

// Blocos de campo compartilhados do editor (spec 096, Fase 4). Um arquivo só
// para os dois utilitários transversais: ambos são o "nível de editor" por
// cima dos primitives de @artificio/ui (R16/A16 — o editor consome os
// primitives, não reimplementa).

/**
 * Campo do editor sobre o `Field` de `@artificio/ui`.
 *
 * Os três níveis de campo (R6), todos marcados:
 * - obrigatório: asterisco do `Field` (`required`) + palavra "Obrigatório"
 *   no hint;
 * - recomendado: sem asterisco, com a frase do ganho abaixo do campo;
 * - opcional: "(opcional)" no próprio rótulo.
 *
 * `data-ob` carrega o nível — é o gancho do A11 (nenhuma marca sem
 * validação): os testes cruzam os `[data-ob="required"]` renderizados com o
 * registro `REQUIRED_FIELD_IDS`/condicionais de editorValidation.ts, que é a
 * MESMA fonte que a validação usa.
 */
interface EditorFieldProps {
  fieldId: string;
  /** Estado real — decide o nível de campos condicionais (ex.: nome do mestre). */
  state: TableEditorState;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function EditorField({
  fieldId,
  state,
  label,
  hint,
  error,
  children,
  className,
}: EditorFieldProps) {
  // O nível vem do registro de validação — fonte única da marca e da regra.
  const level = fieldLevel(fieldId, state);

  const fieldLabel = level === 'optional' ? `${label} (opcional)` : label;

  const resolvedHint =
    level === 'required' ? (hint ? `Obrigatório. ${hint}` : 'Obrigatório.') : hint;

  return (
    <div className={className} data-ob={level} data-field={fieldId}>
      <Field
        id={fieldId}
        label={fieldLabel}
        hint={resolvedHint}
        error={error}
        required={level === 'required'}
      >
        {children}
      </Field>
      {level === 'recommended' && RECOMMENDED_GAIN[fieldId] ? (
        <p className="mt-1 text-xs opacity-75">Recomendado — {RECOMMENDED_GAIN[fieldId]}.</p>
      ) : null}
    </div>
  );
}

/**
 * Toggle de marcação (checkbox semântico) sobre o `Button` de
 * `@artificio/ui` — o pacote não exporta primitivo de checkbox
 * (`packages/ui/src/primitives.tsx` tem Button/Field/TextInput/Textarea/
 * Select/Panel/Modal/Drawer/Badge/Banner/estados), então o `Button` com
 * `aria-pressed` é o controle de duas posições do design system (A16: zero
 * `<input type="checkbox">` cru no editor).
 */
interface ToggleButtonProps {
  pressed: boolean;
  onToggle: (pressed: boolean) => void;
  children: ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function ToggleButton({
  pressed,
  onToggle,
  children,
  id,
  disabled = false,
  className,
  title,
}: ToggleButtonProps) {
  return (
    <Button
      id={id}
      type="button"
      variant={pressed ? 'primary' : 'secondary'}
      size="sm"
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      className={className}
      onClick={() => onToggle(!pressed)}
    >
      {children}
    </Button>
  );
}
