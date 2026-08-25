import { AlertTriangle, Sparkles } from 'lucide-react';
import { Banner, Button, Panel } from '@artificio/ui';
import type { ParserSignals } from '../utils/parserSignals';

/**
 * Fase 6 (spec 096, T6.2/R5): painel de sinais do parser — o backend calcula
 * as ambiguidades e o que não foi reconhecido; este componente EXIBE ao
 * mestre (o front antigo ignorava tudo em silêncio e o mestre não sabia que
 * o parser tinha escolhido por ele).
 *
 * R5: "publicar nunca é bloqueado por isso" — este painel é aviso, não
 * validação: nenhum erro de publish é derivado daqui (T6.5).
 */

type ParserSignalsPanelProps = Readonly<{
  signals: ParserSignals;
  /** Falha 8 do §Gap 4: oferece a sugestão do sistema não casado, pré-preenchida. */
  onSuggestSystem: (name: string) => void;
}>;

/**
 * Tradução das chaves de `missing_fields` do contrato do backend para frases
 * que o mestre entende — nunca exibir a chave crua. Chave desconhecida cai na
 * frase genérica (o contrato pode crescer sem quebrar a exibição).
 */
const MISSING_FIELD_LABELS: Record<string, string> = {
  system_name: 'O sistema não foi reconhecido no catálogo — escolha na lista ou sugira um sistema.',
  'system_name:unmatched_hint': 'O sistema citado não está no catálogo — escolha na lista ou sugira um sistema.',
  day_of_week: 'O dia da sessão não foi encontrado no texto.',
  start_time: 'O horário da sessão não foi encontrado no texto.',
  slots_total: 'O número de vagas não foi encontrado no texto.',
  contact_url: 'O contato/inscrição não foi encontrado no texto.',
  description: 'A descrição não foi encontrada no texto.',
  'price_type:ambiguous': 'Preço ambíguo: o texto cita gratuidade e cobrança. Confira a parte Valores.',
  'day_of_week:multiple_schedules': 'O texto cita mais de um horário. Confira a parte Quando joga.',
  'requires_pc:ambiguous': 'Requisito de computador contraditório no texto.',
  'requires_camera:ambiguous': 'Requisito de câmera contraditório no texto.',
  'requires_microphone:ambiguous': 'Requisito de microfone contraditório no texto.',
  'contact_url:suspicious': 'O link de contato parece suspeito — confira antes de publicar.',
  'contact_url:unconfirmed': 'O link de contato pode não ser de inscrição — confira antes de publicar.',
  'slots_open:ambiguous_x_of_y': 'Vagas ambíguas: não deu para saber qual número é o quê. Confira a parte Quando joga.',
};

function missingFieldLabel(key: string): string {
  return (
    MISSING_FIELD_LABELS[key] ??
    'Um campo não foi reconhecido no texto — confira antes de publicar.'
  );
}

export function ParserSignalsPanel({ signals, onSuggestSystem }: ParserSignalsPanelProps) {
  const messages: string[] = [];
  // Chaves de missing_fields já cobertas pelas mensagens de ambiguidade
  // acima — o backend repete a ambiguidade nas duas formas (flag + chave) e
  // exibi-la duas vezes não acrescenta informação.
  const coveredMissingKeys = new Set<string>();

  if (signals.priceAmbiguous) {
    messages.push('Preço ambíguo: o texto cita gratuidade e cobrança sem padrão claro. Confira a parte Valores.');
    coveredMissingKeys.add('price_type:ambiguous');
  }
  if (signals.scheduleAmbiguous) {
    messages.push('O texto cita 2+ horários diferentes: usamos o primeiro. Confira a parte Quando joga.');
    coveredMissingKeys.add('day_of_week:multiple_schedules');
  }
  if (signals.slotsAmbiguous) {
    const { first, second } = signals.slotsAmbiguous;
    const pair = first !== null && second !== null ? `${first}/${second}` : 'os números';
    messages.push(`Vagas ambíguas: "${pair}" não diz qual número é o quê. Confira a parte Quando joga.`);
    coveredMissingKeys.add('slots_open:ambiguous_x_of_y');
  }

  for (const missing of signals.missingFields) {
    if (coveredMissingKeys.has(missing)) continue;
    const label = missingFieldLabel(missing);
    if (!messages.includes(label)) messages.push(label);
  }

  if (messages.length === 0 && !signals.rawSystemHint) return null;

  return (
    <Panel tone="subtle" className="border-l-2 border-l-[var(--color-artificio-orange)]">
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Revise o que o anúncio não deixou claro
        </p>

        {messages.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-[13px] opacity-90">
            {messages.map((message) => (
              <li key={message} className="flex items-start gap-2">
                <span aria-hidden="true">•</span>
                <span>{message}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {signals.rawSystemHint ? (
          // Falha 8 do §Gap 4: o nome lido NÃO casou no catálogo — o front
          // oferece a sugestão pré-preenchida, sem inventar correspondência.
          <Banner variant="info" className="mt-1">
            <span className="flex flex-wrap items-center gap-2">
              <span>
                O sistema &quot;{signals.rawSystemHint}&quot; não está no catálogo. Você pode
                escolher na lista ou sugerir.
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSuggestSystem(signals.rawSystemHint ?? '')}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Sugerir sistema
              </Button>
            </span>
          </Banner>
        ) : null}
      </div>
    </Panel>
  );
}
