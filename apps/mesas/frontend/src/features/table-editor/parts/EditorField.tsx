import type { ReactNode } from 'react';
import { Badge, Button, Field } from '@artificio/ui';
import type { FieldLevel, TableEditorState } from '../types';
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
 *
 * Fase 6 (spec 096, T6.2/R5): `parserMarked` marca o campo preenchido pela
 * prévia do parser — badge "Pelo anúncio" + `data-parser-source` (gancho do
 * teste). Publicar NUNCA é bloqueado por esta marca (T6.5): ela é só visual,
 * nenhum validador a consulta.
 */
type EditorFieldProps = Readonly<{
  fieldId: string;
  /**
   * `id` do control quando ele NÃO é o `fieldId` — caso de vários controls sob
   * uma mesma chave de validação (os nove campos DDAL, as linhas de horário).
   * Sem isto o label apontaria `htmlFor` para um id inexistente e o leitor de
   * tela não anunciaria rótulo nenhum. A validação continua no `fieldId`.
   */
  controlId?: string;
  /** Estado real — decide o nível de campos condicionais (ex.: nome do mestre). */
  state: TableEditorState;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  /** Fase 6 (T6.2): true quando o valor atual veio da prévia do parser. */
  parserMarked?: boolean;
}>;

/** Campo obrigatório prefixa "Obrigatório." no hint; os demais mantêm o texto. */
function buildHint(level: FieldLevel, hint?: string): string | undefined {
  if (level !== 'required') return hint;
  return hint ? `Obrigatório. ${hint}` : 'Obrigatório.';
}

export function EditorField({
  fieldId,
  controlId,
  state,
  label,
  hint,
  error,
  children,
  className,
  parserMarked = false,
}: EditorFieldProps) {
  // O nível vem do registro de validação — fonte única da marca e da regra.
  const level = fieldLevel(fieldId, state);

  const fieldLabel = level === 'optional' ? `${label} (opcional)` : label;

  const resolvedHint = buildHint(level, hint);

  return (
    <div className={className} data-ob={level} data-field={fieldId} data-parser-source={parserMarked || undefined}>
      {parserMarked ? (
        <p className="mb-0.5 flex items-center gap-1.5">
          <Badge variant="info">Pelo anúncio</Badge>
          <span className="text-xs opacity-75">
            O texto colado preencheu este campo — confira antes de publicar.
          </span>
        </p>
      ) : null}
      <Field
        id={controlId ?? fieldId}
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
type ToggleButtonProps = Readonly<{
  pressed: boolean;
  onToggle: (pressed: boolean) => void;
  children: ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}>;

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
