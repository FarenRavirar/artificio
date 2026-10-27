import { useState } from 'react';
import { Field, TextInput } from '@artificio/ui';

interface CommitTextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly initialValue: string;
  readonly placeholder?: string;
  /** Devolve a mensagem de erro, ou `null` quando o valor serve. */
  readonly validate: (value: string) => string | null;
  /** Devolve a mensagem de erro do servidor (ex.: username em uso) ou `null`. */
  readonly onCommit: (value: string) => Promise<string | null | void> | void;
}

/**
 * Campo que grava ao SAIR (blur ou Enter), não a cada tecla (spec 106 R6, D18).
 *
 * Gravar por tecla mandava "v", "vo", "voi" ao servidor, que recusa menos de 3
 * caracteres, e o contexto descartava a tecla enquanto a requisição anterior
 * estava em voo. Aqui o servidor só recebe valor completo e já validado.
 * Valor inválido fica no campo com o erro visível e nada é enviado.
 */
export function CommitTextField({
  id,
  label,
  hint,
  initialValue,
  placeholder,
  validate,
  onCommit,
}: CommitTextFieldProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    const next = value.trim();
    // Sem mudança não há o que validar nem gravar (username novo começa vazio).
    if (next === initialValue.trim()) {
      setError(null);
      return;
    }
    const problem = validate(next);
    setError(problem);
    if (problem) return;
    // Recusa do servidor (username em uso etc.) fica no campo, não só no indicador.
    const serverError = await onCommit(next);
    if (serverError) setError(serverError);
  };

  return (
    <Field id={id} label={label} hint={hint} error={error ?? undefined}>
      <TextInput
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) void commit();
        }}
        invalid={!!error}
        placeholder={placeholder}
        aria-describedby={`${id}-description`}
      />
    </Field>
  );
}
