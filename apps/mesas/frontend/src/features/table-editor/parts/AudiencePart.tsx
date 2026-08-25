import { useState, type FormEvent } from 'react';
import { Button, Select, TextInput } from '@artificio/ui';
import type { TableEditorApi } from '../hooks/useTableEditor';
import { EditorField, ToggleButton } from './EditorField';
import type { TableEditorState } from '../types';
import {
  SAFETY_TOOL_DESCRIPTIONS,
  CONTENT_WARNING_DESCRIPTIONS,
} from '../../../utils/safetyToolsGlossary';

const TYPE_OPTIONS = [
  { value: 'campanha', label: 'Campanha' },
  { value: 'one-shot', label: 'One-Shot' },
  { value: 'oneshot-serie', label: 'One-Shot em Série' },
  { value: 'aberta', label: 'Mesa Aberta' },
];

const AGE_OPTIONS = [
  { value: 'livre', label: '🟢 Livre (Todos os públicos)' },
  { value: '+10', label: '🟡 +10 anos' },
  { value: '+12', label: '🟡 +12 anos' },
  { value: '+14', label: '🟠 +14 anos' },
  { value: '+16', label: '🟠 +16 anos' },
  { value: '+18', label: '🔴 +18 anos' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'todos', label: 'Todos os Níveis' },
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'veterano', label: 'Veterano' },
];

const LEVEL_OPTIONS = [
  { value: '', label: 'Selecione o nível' },
  { value: 'todos', label: 'Todos os Níveis' },
  { value: 'iniciante', label: 'Iniciante (regras simples)' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado (regras complexas)' },
];

/**
 * Parte "Para quem é": tipo de mesa, faixa etária (RECOMENDADO — R6.1, sem
 * asterisco e com a frase do ganho), experiência, complexidade, idioma e a
 * segurança de mesa (R23/T4.0w): content_warnings/safety_tools com os 14
 * termos do glossário como pills + entrada livre.
 */
interface AudiencePartProps {
  api: TableEditorApi;
}

export function AudiencePart({ api }: AudiencePartProps) {
  const { state, patch, validateFieldOnBlur } = api;

  return (
    <div className="flex flex-col gap-3.5 max-w-[900px] h-full overflow-hidden">
      <div className="flex flex-wrap gap-3.5 items-start">
        <EditorField
          fieldId="type"
          state={state}
          label="Tipo de mesa"
          hint="Campanha, one-shot, série ou mesa aberta."
        >
          <Select
            id="type"
            value={state.type}
            onChange={(e) => patch({ type: e.target.value })}
            onBlur={() => validateFieldOnBlur('type')}
            className="!w-[206px]"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </EditorField>

        {/* Faixa etária RECOMENDADO (R6.1): sem asterisco, com frase do ganho;
            publicar não é bloqueado por ela. */}
        <EditorField
          fieldId="ageRating"
          state={state}
          label="Faixa etária"
          hint="O dado certo resolve o erro de produção: o payload agora grava a escolha (T3.2)."
        >
          <Select
            id="ageRating"
            value={state.ageRating}
            onChange={(e) => patch({ ageRating: e.target.value })}
            onBlur={() => validateFieldOnBlur('ageRating')}
            className="!w-[206px]"
          >
            {/* Mesa antiga pode ter faixa nula ("não informado") — sem esta
                opção o select renderizaria 'livre' sem o mestre escolher. */}
            <option value="">Selecione a faixa etária</option>
            {AGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </EditorField>
      </div>

      <div className="flex flex-wrap gap-3.5 items-start">
        <EditorField fieldId="experienceLevel" state={state} label="Experiência do jogador">
          <Select
            id="experienceLevel"
            value={state.experienceLevel}
            onChange={(e) => patch({ experienceLevel: e.target.value })}
            className="!w-[206px]"
          >
            {EXPERIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </EditorField>

        <EditorField fieldId="tableLevel" state={state} label="Complexidade da mesa">
          <Select
            id="tableLevel"
            value={state.tableLevel}
            onChange={(e) => patch({ tableLevel: e.target.value })}
            className="!w-[206px]"
          >
            {LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </EditorField>

        <EditorField fieldId="language" state={state} label="Idioma">
          <TextInput
            id="language"
            value={state.language}
            onChange={(e) => patch({ language: e.target.value })}
            placeholder="Português"
            className="!w-[206px]"
          />
        </EditorField>
      </div>

      {/* Segurança de mesa (R23): glossário curado como pills + entrada livre.
          Nunca campo aberto cru — a página pública casa a descrição por chave
          normalizada. */}
      <SafetyTermsField
        fieldId="contentWarnings"
        state={state}
        label="Avisos de conteúdo"
        hint="O que pode aparecer na mesa — o jogador vê a descrição de cada termo."
        terms={Object.keys(CONTENT_WARNING_DESCRIPTIONS)}
        descriptions={CONTENT_WARNING_DESCRIPTIONS}
        selected={state.contentWarnings}
        onChange={(next) => patch({ contentWarnings: next })}
      />

      <SafetyTermsField
        fieldId="safetyTools"
        state={state}
        label="Ferramentas de segurança"
        hint="Como a mesa lida com cenas sensíveis."
        terms={Object.keys(SAFETY_TOOL_DESCRIPTIONS)}
        descriptions={SAFETY_TOOL_DESCRIPTIONS}
        selected={state.safetyTools}
        onChange={(next) => patch({ safetyTools: next })}
      />
    </div>
  );
}

/**
 * Campo de termos de segurança/avisos de conteúdo (R23/A26, T4.0w).
 *
 * Oferece os termos do glossário curado como pills selecionáveis
 * (`utils/safetyToolsGlossary.ts` — 6 ferramentas, 8 avisos), com entrada
 * livre para o que não estiver na lista. NUNCA campo de texto aberto cru:
 * as colunas são `text[]` sem enum e a página pública casa a descrição por
 * chave normalizada — "violencia" sem acento perderia a descrição que o
 * jogador vê.
 *
 * Termos já salvos que não estão no glossário continuam aparecendo como
 * chips removíveis (mesa legada com termo livre não perde o valor).
 */
interface SafetyTermsFieldProps {
  fieldId: string;
  state: TableEditorState;
  label: string;
  hint?: string;
  /** chaves do glossário (ex.: SAFETY_TOOL_DESCRIPTIONS). */
  terms: readonly string[];
  descriptions: Record<string, string>;
  selected: string[];
  onChange: (next: string[]) => void;
}

function SafetyTermsField({
  fieldId,
  state,
  label,
  hint,
  terms,
  descriptions,
  selected,
  onChange,
}: SafetyTermsFieldProps) {
  const [freeValue, setFreeValue] = useState('');

  const toggle = (term: string) => {
    onChange(
      selected.includes(term) ? selected.filter((t) => t !== term) : [...selected, term],
    );
  };

  const addFreeTerm = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = freeValue.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) onChange([...selected, trimmed]);
    setFreeValue('');
  };

  const customTerms = selected.filter((term) => !terms.includes(term));

  return (
    <EditorField fieldId={fieldId} state={state} label={label} hint={hint}>
      <div className="flex flex-wrap gap-1.5" id={fieldId}>
        {terms.map((term) => (
          <ToggleButton
            key={term}
            pressed={selected.includes(term)}
            onToggle={() => toggle(term)}
            title={descriptions[term]}
          >
            {term}
          </ToggleButton>
        ))}
        {customTerms.map((term) => (
          <ToggleButton key={term} pressed onToggle={() => toggle(term)}>
            {term}
          </ToggleButton>
        ))}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={addFreeTerm}>
        <TextInput
          id={`${fieldId}-free`}
          value={freeValue}
          onChange={(e) => setFreeValue(e.target.value)}
          placeholder="Termo fora da lista…"
          aria-label={`Termo livre para ${label}`}
          className="flex-1 max-w-[260px]"
        />
        <Button type="submit" variant="secondary" size="sm">
          Adicionar
        </Button>
      </form>
    </EditorField>
  );
}
