import { useState, type KeyboardEvent } from 'react';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /**
   * `id`/`aria-label` do input interno — opcionais para nao quebrar os usos
   * anteriores. Obrigatorios quando o TagInput vive dentro de um `Field` do
   * pacote: o `label` do `Field` aponta `htmlFor` para o `id`, e sem ele o
   * leitor de tela nao anuncia rotulo nenhum (spec 099 B3).
   */
  id?: string;
  ariaLabel?: string;
  /**
   * Id do `<p>` de hint/erro do `Field` do pacote (`${id}-description`), que
   * nao associa o controle automaticamente (spec 099 B7) — repassado direto
   * ao input como `aria-describedby`.
   */
  describedBy?: string;
}

/**
 * Input de tags estilo WordPress: digita e Enter (ou virgula) adiciona um chip.
 * Backspace com campo vazio remove o ultimo. Deduplica ignorando caixa/espacos.
 */
export const TagInput = ({ value, onChange, placeholder, id, ariaLabel, describedBy }: Props) => {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    const exists = value.some((v) => v.toLowerCase() === tag.toLowerCase());
    if (!exists) onChange([...value, tag]);
    setDraft('');
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      remove(value.length - 1);
    }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 rounded bg-blue-600/30 border border-blue-500/40 px-2 py-0.5 text-xs text-blue-100"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(index)}
            className="text-blue-200 hover:text-white"
            aria-label={`Remover ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className="flex-1 min-w-[8rem] bg-transparent px-1 py-0.5 text-white text-sm outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => add(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
      />
    </div>
  );
};
