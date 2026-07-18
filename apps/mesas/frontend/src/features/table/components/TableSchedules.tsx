import type { TableViewModel } from '../types/tableView.types';
import { Calendar, Clock, Repeat } from 'lucide-react';

const dayAbbrev: Record<string, string> = {
  segunda: 'SEG',
  terça: 'TER',
  quarta: 'QUA',
  quinta: 'QUI',
  sexta: 'SEX',
  sábado: 'SAB',
  domingo: 'DOM',
};

interface TableSchedulesProps {
  vm: TableViewModel;
}

/**
 * Exibe horários das sessões
 * Reutilizável em: MesaPage, Preview, Catálogo expandido
 */
export function TableSchedules({ vm }: TableSchedulesProps) {
  // CORREÇÃO REG-08: Sempre renderizar seção, mesmo se vazio (com fallback)
  const hasSchedules = vm.schedules && vm.schedules.length > 0;
  const hasDefinedStatus = vm.scheduleDayStatus === 'to_define' || vm.scheduleTimeStatus === 'to_define';
  const dayLabel = vm.scheduleDayStatus === 'to_define'
    ? 'Dia a definir'
    : (vm.scheduleDayHint ?? 'Dia não informado');
  const timeLabel = vm.scheduleTimeStatus === 'to_define'
    ? 'Horário a definir'
    : (vm.scheduleTimeHint ?? 'Horário não informado');

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-bold mb-4">📅 Horários das Sessões</h2>
      
      {!hasSchedules && hasDefinedStatus ? (
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[var(--surface-input)] p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-artificio-orange)]/15 text-[var(--color-artificio-orange)]">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-white">{dayLabel}</p>
            <p className="text-sm text-white/60">{timeLabel}</p>
          </div>
        </div>
      ) : !hasSchedules ? (
        <p className="text-sm text-white/60">
          Horários não informados pelo mestre. Entre em contato para mais detalhes.
        </p>
      ) : (
        <>
          {/* Grid 2 colunas só quando há 2+ horários — achado do mantenedor:
              1 único schedule sobrava espaço vazio à direita com sm:grid-cols-2 fixo. */}
          <div className={`grid gap-3 ${vm.schedules.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {vm.schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-[var(--surface-input)] p-4"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--color-artificio-orange)]/15 text-[var(--color-artificio-orange)]">
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    {/* Normaliza pra lowercase antes de indexar dayAbbrev (achado Codex):
                        backend pode mandar "Sábado" capitalizado, dayAbbrev usa chaves
                        lowercase — sem normalizar, cai no fallback e corta acento errado. */}
                    {dayAbbrev[schedule.day_of_week.toLowerCase()] ?? schedule.day_of_week.slice(0, 3).toUpperCase()}
                  </span>
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold capitalize text-white">{schedule.day_of_week}</p>
                  <p className="flex items-center gap-1.5 text-sm text-white/60">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {schedule.start_time}{schedule.end_time ? ` - ${schedule.end_time}` : ''}
                  </p>
                  {schedule.frequency && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                      <Repeat className="h-3 w-3" /> {schedule.frequency}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {vm.startsAt && (
            <p className="mt-4 text-sm text-white/60">
              Início: {new Date(vm.startsAt).toLocaleDateString('pt-BR')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
