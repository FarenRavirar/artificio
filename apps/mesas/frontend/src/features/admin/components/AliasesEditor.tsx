import { useState } from 'react';

interface Props {
  value: string[];
  onChange: (aliases: string[]) => void;
}

export function AliasesEditor({ value, onChange }: Props) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.some(a => a.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
    setDraft('');
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((alias, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded text-sm text-white">
            {alias}
            <button
              onClick={() => remove(i)}
              className="text-white/60 hover:text-white"
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ex: D&D"
          className="flex-1 px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={add}
          type="button"
          className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
