import { SessionRepeater, type SessionSchedule } from '../../SessionRepeater';
import type { Dispatch, SetStateAction } from 'react';
import type { BasicFormData } from '../../../features/create-table/types/createTable.types';

interface StepSessionsProps {
  sessions: SessionSchedule[];
  setSessions: (sessions: SessionSchedule[]) => void;
  form: BasicFormData;
  setForm: Dispatch<SetStateAction<BasicFormData>>;
}

export function StepSessions({ 
  sessions, 
  setSessions,
  form,
  setForm,
}: StepSessionsProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[var(--surface-input)]/60 p-4">
        <SessionRepeater
          sessions={sessions}
          onChange={setSessions}
          disabled={false}
        />
      </div>

      {/* Vagas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="slots_total" className="text-sm font-medium text-white/70">
            Vagas Totais
          </label>
          <input
            id="slots_total"
            name="slots_total"
            type="number"
            min="1"
            max="20"
            value={form.slots_total}
            onChange={handleChange}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 focus:ring-1 focus:ring-[var(--color-artificio-orange)]/30 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="slots_open" className="text-sm font-medium text-white/70">
            Vagas Abertas para Recrutamento
          </label>
          <input
            id="slots_open"
            name="slots_open"
            type="number"
            min="0"
            max={form.slots_total || "20"}
            value={form.slots_open}
            onChange={handleChange}
            placeholder="Quantas vagas estão abertas para novos jogadores?"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 focus:ring-1 focus:ring-[var(--color-artificio-orange)]/30 transition-all"
          />
          <p className="text-xs text-white/50 mt-1">
            💡 Vagas abertas devem ser menores ou iguais ao total de jogadores
          </p>
        </div>
      </div>
    </div>
  );
}
