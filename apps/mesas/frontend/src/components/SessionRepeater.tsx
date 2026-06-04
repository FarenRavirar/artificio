import { useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';

export interface SessionSchedule {
  id?: string;
  day_of_week: 'segunda' | 'terça' | 'quarta' | 'quinta' | 'sexta' | 'sábado' | 'domingo' | 'to_define';
  start_time: string; // HH:MM
  end_time?: string; // HH:MM - CORREÇÃO REG-01: Opcional para compatibilidade com backend
  frequency: 'semanal' | 'quinzenal' | 'mensal' | 'avulsa';
  slots_per_session?: number | null;
  is_ongoing: boolean;
  notes?: string; // CORREÇÃO REG-01: Opcional para compatibilidade
  sort_order: number;
}

interface SessionRepeaterProps {
  sessions: SessionSchedule[];
  onChange: (sessions: SessionSchedule[]) => void;
  disabled?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'to_define', label: 'Dia da semana a definir' },
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terça', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sábado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
] as const;

const SCHEDULE_FREQUENCIES = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'avulsa', label: 'Avulsa' },
] as const;



export function SessionRepeater({ sessions, onChange, disabled = false }: SessionRepeaterProps) {
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);

  const handleAddSession = () => {
    const newSession: SessionSchedule = {
      day_of_week: 'segunda',
      start_time: '19:00',
      end_time: '22:00',
      frequency: 'semanal',
      is_ongoing: false,
      notes: '',
      sort_order: sessions.length,
    };
    onChange([...sessions, newSession]);
  };

  const handleRemoveSession = (index: number) => {
    if (sessions.length === 1) {
      return; // Não permitir remover se só houver 1 sessão
    }

    if (removeConfirm === index) {
      const updated = sessions.filter((_, i) => i !== index);
      // Recalcular sort_order
      const reordered = updated.map((s, i) => ({ ...s, sort_order: i }));
      onChange(reordered);
      setRemoveConfirm(null);
    } else {
      setRemoveConfirm(index);
      setTimeout(() => setRemoveConfirm(null), 3000); // Reset após 3s
    }
  };

  const handleUpdateSession = <K extends keyof SessionSchedule>(
    index: number,
    field: K,
    value: SessionSchedule[K]
  ) => {
    const updated = sessions.map((session, i) => {
      if (i === index) {
        return { ...session, [field]: value };
      }
      return session;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
              <p className="text-sm font-semibold text-white">Horários das Sessões *</p>
              <p className="text-xs text-white/60 mt-1">
            Adicione os horários conhecidos ou marque dia/horário a definir.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddSession}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange)]/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusCircle className="w-4 h-4" />
          Adicionar Horário
        </button>
      </div>

      <div className="space-y-3">
        {sessions.map((session, index) => (
          <div
            key={index}
            className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">
                Sessão {index + 1}
              </p>
              <button
                type="button"
                onClick={() => handleRemoveSession(index)}
                disabled={disabled || sessions.length === 1}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  removeConfirm === index
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/70'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                title={sessions.length === 1 ? 'Pelo menos 1 sessão é obrigatória' : 'Remover sessão'}
              >
                <Trash2 className="w-3 h-3" />
                {removeConfirm === index ? 'Confirmar?' : 'Remover'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Dia da semana */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black uppercase tracking-widest text-white/70">
                  Dia da Semana *
                </label>
                <select
                  value={session.day_of_week}
                  onChange={(e) =>
                    handleUpdateSession(index, 'day_of_week', e.target.value as SessionSchedule['day_of_week'])
                  }
                  disabled={disabled}
                  className="app-select w-full px-4 py-2.5"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>



              {/* Frequência */}
              <div className="flex flex-col gap-1">
                <label htmlFor={`session-${index}-frequency`} className="text-xs font-black uppercase tracking-widest text-white/70">
                  Frequência *
                </label>
                <select
                  id={`session-${index}-frequency`}
                  value={session.frequency}
                  onChange={(e) =>
                    handleUpdateSession(index, 'frequency', e.target.value as SessionSchedule['frequency'])
                  }
                  disabled={disabled}
                  className="app-select w-full px-4 py-2.5"
                >
                  {SCHEDULE_FREQUENCIES.map((freq) => (
                    <option key={freq.value} value={freq.value}>
                      {freq.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Horário inicial */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black uppercase tracking-widest text-white/70">
                  Horário Inicial *
                </label>
                <label className="mb-1 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={!session.start_time}
                    onChange={(e) => handleUpdateSession(index, 'start_time', e.target.checked ? '' : '19:00')}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-[var(--color-artificio-orange)] focus:ring-[var(--color-artificio-orange)] disabled:opacity-50"
                  />
                  Horário a definir
                </label>
                <input
                  type="time"
                  value={session.start_time}
                  onChange={(e) => handleUpdateSession(index, 'start_time', e.target.value)}
                  disabled={disabled || !session.start_time}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[var(--color-artificio-orange)]/60 focus:ring-1 focus:ring-[var(--color-artificio-orange)]/30 transition-all disabled:opacity-50"
                />
              </div>

              {/* Horário final */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black uppercase tracking-widest text-white/70">
                  Horário Final
                </label>
                <input
                  type="time"
                  value={session.end_time}
                  onChange={(e) => handleUpdateSession(index, 'end_time', e.target.value)}
                  disabled={disabled || !session.start_time}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[var(--color-artificio-orange)]/60 focus:ring-1 focus:ring-[var(--color-artificio-orange)]/30 transition-all disabled:opacity-50"
                />
              </div>

              {/* Checkbox: Em andamento */}
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id={`session-${index}-ongoing`}
                  checked={session.is_ongoing}
                  onChange={(e) => handleUpdateSession(index, 'is_ongoing', e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-[var(--color-artificio-orange)] focus:ring-[var(--color-artificio-orange)] disabled:opacity-50"
                />
                <label
                  htmlFor={`session-${index}-ongoing`}
                  className="text-sm text-white/70 cursor-pointer"
                >
                  Sessão em andamento
                </label>
              </div>
            </div>

            {/* Observações */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black uppercase tracking-widest text-white/70">
                Observações (opcional)
              </label>
              <textarea
                value={session.notes}
                onChange={(e) => handleUpdateSession(index, 'notes', e.target.value)}
                placeholder="Ex: Vagas limitadas para jogadores experientes"
                rows={2}
                disabled={disabled}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-[var(--color-artificio-orange)]/60 focus:ring-1 focus:ring-[var(--color-artificio-orange)]/30 transition-all resize-none disabled:opacity-50"
              />
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
          <p className="text-sm text-red-300">
            Adicione um horário ou marque a agenda como a definir
          </p>
        </div>
      )}
    </div>
  );
}
