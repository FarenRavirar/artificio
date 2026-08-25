import { ContentEditor } from '@artificio/content-editor';
import { Select, TextInput } from '@artificio/ui';
import type { SessionSchedule } from '../../../components/SessionRepeater';
import type { TableEditorApi } from '../hooks/useTableEditor';
import { EditorField, ToggleButton } from './EditorField';
import type { TableEditorState } from '../types';

const DAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'to_define', label: 'Dia da semana a definir' },
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terça', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sábado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
  // R20/T4.0u: UM horário só, mais "horário personalizado" — grava
  // schedule_day_status='to_define' + texto em table_schedules.notes.
  { value: 'personalized', label: 'Horário personalizado' },
];

const FREQUENCY_OPTIONS = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'avulsa', label: 'Avulsa' },
] as const;

/**
 * Parte "Quando joga" (T4.0u): UMA configuração de horário (dia, horário com
 * "a combinar", frequência, fim opcional, observação e "horário
 * personalizado") + vagas totais/abertas (1–20). SEM repeater e SEM "Vagas
 * por sessão" (slots_per_session — removido por R20).
 */
interface WhenPartProps {
  api: TableEditorApi;
}

export function WhenPart({ api }: WhenPartProps) {
  const { state, patch, errors, validateFieldOnBlur } = api;
  const schedule = state.schedules[0];

  return (
    <div className="flex flex-col gap-3.5 max-w-[900px] h-full overflow-hidden">
      <SingleScheduleEditor
        state={state}
        schedule={schedule}
        isPersonalized={state.isPersonalizedSchedule}
        onChange={(partial) => {
          const updated = { ...schedule, ...partial };
          patch({ schedules: [updated, ...state.schedules.slice(1)] });
        }}
        onTogglePersonalized={(personalized) =>
          patch({ isPersonalizedSchedule: personalized })
        }
        error={errors.schedules}
        onFieldBlur={validateFieldOnBlur}
      />

      <div className="flex flex-wrap gap-3.5 items-start">
        <EditorField
          fieldId="slotsTotal"
          state={state}
          label="Vagas totais"
          hint="Entre 1 e 20."
          error={errors.slotsTotal}
        >
          <TextInput
            id="slotsTotal"
            type="number"
            min={1}
            max={20}
            value={state.slotsTotal}
            onChange={(e) => patch({ slotsTotal: e.target.value })}
            onBlur={() => validateFieldOnBlur('slotsTotal')}
            invalid={!!errors.slotsTotal}
            className="!w-[120px]"
          />
        </EditorField>

        <EditorField
          fieldId="slotsOpen"
          state={state}
          label="Vagas abertas para recrutamento"
          hint="Menor ou igual ao total."
          error={errors.slotsOpen}
        >
          <TextInput
            id="slotsOpen"
            type="number"
            min={0}
            max={20}
            value={state.slotsOpen}
            onChange={(e) => patch({ slotsOpen: e.target.value })}
            onBlur={() => validateFieldOnBlur('slotsOpen')}
            invalid={!!errors.slotsOpen}
            className="!w-[120px]"
          />
        </EditorField>
      </div>
    </div>
  );
}

/**
 * Configuração ÚNICA de horário (T4.0u): dia (incluindo "a definir" e
 * "personalizado"), horário (com "a combinar"), frequência, fim opcional e
 * observação. SEM repeater e SEM "Vagas por sessão" (slots_per_session —
 * removido por R20; o payload nunca o envia).
 */
interface SingleScheduleEditorProps {
  state: TableEditorState;
  schedule: SessionSchedule;
  isPersonalized: boolean;
  onChange: (patch: Partial<SessionSchedule>) => void;
  onTogglePersonalized: (personalized: boolean) => void;
  error?: string;
  onFieldBlur: (fieldId: string) => void;
}

function SingleScheduleEditor({
  state,
  schedule,
  isPersonalized,
  onChange,
  onTogglePersonalized,
  error,
  onFieldBlur,
}: SingleScheduleEditorProps) {
  const selectValue = isPersonalized ? 'personalized' : schedule.day_of_week;

  const handleDayChange = (value: string) => {
    if (value === 'personalized') {
      onTogglePersonalized(true);
      return;
    }
    onTogglePersonalized(false);
    onChange({ day_of_week: value as SessionSchedule['day_of_week'] });
  };

  return (
    <div>
      <EditorField
        fieldId="schedules"
        state={state}
        label="Horário das sessões"
        hint="Um horário fixo, uma agenda a definir ou uma agenda personalizada explicada por você."
        error={error}
      >
        <Select
          id="schedules"
          value={selectValue}
          onChange={(e) => handleDayChange(e.target.value)}
          onBlur={() => onFieldBlur('schedules')}
          invalid={!!error}
        >
          {DAY_OPTIONS.map((day) => (
            <option key={day.value} value={day.value}>
              {day.label}
            </option>
          ))}
        </Select>
      </EditorField>

      {isPersonalized ? (
        <EditorField
          fieldId="isPersonalizedSchedule"
          state={state}
          label="Explique sua agenda"
          hint="Ex.: quinzenal, alternando sábado e domingo, combinado no grupo."
        >
          <ContentEditor
            value={schedule.notes ?? ''}
            onChange={(value) => onChange({ notes: value })}
            label="Explicação da agenda personalizada"
            placeholder="Escreva como a agenda funciona…"
            minHeight={112}
            maxLength={500}
          />
        </EditorField>
      ) : (
        <>
          <div>
            <EditorField
              fieldId="schedules"
              state={state}
              label="Horário de início"
            >
              <TextInput
                id="schedules-time"
                type="time"
                value={schedule.start_time}
                disabled={!schedule.start_time}
                onChange={(e) => onChange({ start_time: e.target.value })}
                onBlur={() => onFieldBlur('schedules')}
              />
            </EditorField>
            <EditorField fieldId="schedules" state={state} label="Frequência">
              <Select
                id="schedules-frequency"
                value={schedule.frequency}
                onChange={(e) => onChange({ frequency: e.target.value as SessionSchedule['frequency'] })}
                onBlur={() => onFieldBlur('schedules')}
              >
                {FREQUENCY_OPTIONS.map((freq) => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label}
                  </option>
                ))}
              </Select>
            </EditorField>
          </div>

          <div>
            <EditorField fieldId="schedules" state={state} label="Horário de término">
              <TextInput
                id="schedules-end"
                type="time"
                value={schedule.end_time ?? ''}
                disabled={!schedule.start_time}
                onChange={(e) => onChange({ end_time: e.target.value || undefined })}
              />
            </EditorField>
            <ToggleButton
              id="schedules-time-to-define"
              pressed={!schedule.start_time}
              onToggle={(pressed) => onChange({ start_time: pressed ? '' : '19:00' })}
            >
              Horário a combinar
            </ToggleButton>
          </div>

          <ToggleButton
            id="schedules-ongoing"
            pressed={schedule.is_ongoing}
            onToggle={(pressed) => onChange({ is_ongoing: pressed })}
          >
            Sessão em andamento
          </ToggleButton>

          <EditorField fieldId="schedules" state={state} label="Observações">
            <ContentEditor
              value={schedule.notes ?? ''}
              onChange={(value) => onChange({ notes: value })}
              label="Observações da sessão"
              placeholder="Ex: Vagas limitadas para jogadores experientes"
              minHeight={96}
              maxLength={500}
            />
          </EditorField>
        </>
      )}
    </div>
  );
}
