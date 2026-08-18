import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { MarkdownEditor } from '../../MarkdownEditor';
import type { BasicFormData } from '../../../features/create-table/types/createTable.types';
import { DESCRIPTION_MAX_LENGTH } from '../../../features/create-table/utils/validation';

interface StepBasicProps {
  form: BasicFormData;
  setForm: Dispatch<SetStateAction<BasicFormData>>;
}

export function StepBasic({ form, setForm }: StepBasicProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-white/70">
          Título da Mesa *
        </label>
        <input
          id="title"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Ex: A Queda do Império Sombrio"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 focus:ring-1 focus:ring-[var(--color-artificio-orange)]/30 transition-all"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-white/70">Descrição da Mesa</label>
        <MarkdownEditor
          value={form.description}
          onChange={(text) => setForm({ ...form, description: text })}
          label="Descrição da mesa"
          placeholder="Descreva sua campanha, o tom da história, o que esperar..."
          height={300}
          // Sem isto o editor não mostrava contador nenhum, e o limite só
          // aparecia como erro no "Continuar" — depois de o mestre já ter
          // colado o texto inteiro (achado do mantenedor, 2026-08-18).
          maxLength={DESCRIPTION_MAX_LENGTH}
        />
      </div>
    </div>
  );
}
