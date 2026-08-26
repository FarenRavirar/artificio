import { Select, TextInput } from '@artificio/ui';
import { ContentEditor } from '@artificio/content-editor';
import type { TableEditorApi } from '../hooks/useTableEditor';
import { EditorField, ToggleButton } from './EditorField';
import { normalizePriceType, normalizePriceFrequency } from '../utils/editorMapping';
import { EDITOR_TEXT_LIMITS } from '../utils/editorValidation';

/**
 * Parte "Valores" (R21/T4.0v): todos os campos de valor numa parte só, na
 * ordem da decisão — cobrança → valores → doação → sessão zero → detalhes.
 *
 * Efeitos preservados (T4.0d, paridade com StepConfig):
 * - trocar para "gratuita" LIMPA os preços (campo invisível);
 * - trocar para "paga" LIMPA a doação (campo invisível);
 * - desmarcar doação LIMPA o valor sugerido;
 * - detalhes de cobrança aparecem se `paga` OU já houver billingText.
 */
type ValuesPartProps = Readonly<{
  api: TableEditorApi;
}>;

export function ValuesPart({ api }: ValuesPartProps) {
  const { state, patch, errors, validateFieldOnBlur, parserFilledFields } = api;

  const isPaid = normalizePriceType(state.priceType) === 'paga';

  // Auditoria adversarial (sessão 26-08-22_1, A1): trocar de modalidade de
  // cobrança limpa o campo que some da tela — sem isso o mapper envia valor
  // residual e o backend responde 400 sobre campo invisível.
  const handlePriceTypeChange = (value: string) => {
    if (value === 'gratuita') {
      // sessionZeroFree entra junto: o toggle só existe no bloco de mesa paga,
      // então marcá-lo e depois virar gratuita deixava "sessão zero é
      // gratuita" viajando no payload de uma mesa que já é toda gratuita.
      // priceFrequency entra junto pela mesma razão: só existe em mesa paga, e
      // o payload já a força a null quando gratuita (T7.2b2).
      patch({
        priceType: value,
        priceValue: '',
        priceValueMonthly: '',
        priceFrequency: '',
        sessionZeroFree: false,
      });
      return;
    }
    patch({ priceType: value, acceptsDonations: false, suggestedDonationValue: '' });
  };

  const handleAcceptsDonationsToggle = (accepts: boolean) => {
    patch({
      acceptsDonations: accepts,
      ...(accepts ? {} : { suggestedDonationValue: '' }),
    });
  };

  return (
    <div className="flex flex-col gap-3.5 max-w-[900px]">
      <EditorField
        fieldId="priceType"
        state={state}
        parserMarked={parserFilledFields.has('priceType')}
        label="Cobrança"
        hint="Gratuita ou paga."
      >
        <Select
          id="priceType"
          value={state.priceType}
          onChange={(e) => handlePriceTypeChange(e.target.value)}
          onBlur={() => validateFieldOnBlur('priceType')}
        >
          <option value="gratuita">Gratuita</option>
          <option value="paga">Paga</option>
        </Select>
      </EditorField>

      {isPaid && (
        <>
          <div className="flex flex-wrap gap-3.5 items-start">
            <EditorField
              fieldId="priceValue"
              state={state}
              parserMarked={parserFilledFields.has('priceValue')}
              label="Valor por sessão avulsa (R$)"
              hint="Obrigatório para mesa paga."
              error={errors.priceValue}
            >
              <TextInput
                id="priceValue"
                type="number"
                min={0}
                step="0.01"
                value={state.priceValue}
                onChange={(e) => patch({ priceValue: e.target.value })}
                onBlur={() => validateFieldOnBlur('priceValue')}
                invalid={!!errors.priceValue}
                placeholder="Ex: 25.00"
                className="!w-[120px]"
              />
            </EditorField>

            <EditorField
              fieldId="priceValueMonthly"
              state={state}
              parserMarked={parserFilledFields.has('priceValueMonthly')}
              label="Valor por sessão no pacote mensal (R$)"
              hint="Opcional — valor individual por sessão para quem fecha o pacote mensal."
            >
              <TextInput
                id="priceValueMonthly"
                type="number"
                min={0}
                step="0.01"
                value={state.priceValueMonthly}
                onChange={(e) => patch({ priceValueMonthly: e.target.value })}
                placeholder="Ex: 40.00"
                className="!w-[120px]"
              />
            </EditorField>
          </div>

          <div className="flex flex-wrap gap-3.5 items-start">
            {/* T7.2b2 (spec 096): a coluna `price_frequency` já era exibida no
                público ("/ sessão" ao lado do preço, TableActionPanel.tsx) e
                gravada pelo parser, mas o editor não a coletava — o mestre não
                tinha como dizer se o valor era por sessão, por mês ou pela
                campanha inteira. */}
            <EditorField
              fieldId="priceFrequency"
              state={state}
              parserMarked={parserFilledFields.has('priceFrequency')}
              label="Periodicidade da cobrança"
              hint="Como o valor é cobrado. Aparece ao lado do preço na página da mesa."
            >
              <Select
                id="priceFrequency"
                value={state.priceFrequency}
                // Normaliza também aqui, e não só na leitura da API: o valor do
                // `<select>` é `string` para o compilador, e o state é a union.
                // Mesma função dos dois lados — regra do enum num lugar só.
                onChange={(e) => patch({ priceFrequency: normalizePriceFrequency(e.target.value) })}
              >
                <option value="">Não informar</option>
                <option value="sessao">Por sessão</option>
                <option value="mes">Por mês</option>
                <option value="campanha">Pela campanha</option>
              </Select>
            </EditorField>

            <EditorField
              fieldId="sessionZeroFree"
              state={state}
              parserMarked={parserFilledFields.has('sessionZeroFree')}
              label="Sessão zero"
            >
              <ToggleButton
                id="session_zero_free"
                pressed={state.sessionZeroFree}
                onToggle={(pressed) => patch({ sessionZeroFree: pressed })}
              >
                Sessão zero é gratuita
              </ToggleButton>
            </EditorField>
          </div>
        </>
      )}

      {!isPaid && (
        <EditorField
          fieldId="acceptsDonations"
          state={state}
          parserMarked={parserFilledFields.has('acceptsDonations') || parserFilledFields.has('suggestedDonationValue')}
          label="Doações"
          hint="Mesa gratuita pode aceitar doações combinadas diretamente com o mestre, fora da plataforma."
        >
          <div className="flex flex-wrap gap-2 items-center">
            <ToggleButton
              id="accepts_donations"
              pressed={state.acceptsDonations}
              onToggle={handleAcceptsDonationsToggle}
            >
              Aceita doações
            </ToggleButton>
            {state.acceptsDonations && (
              <TextInput
                id="suggestedDonationValue"
                type="number"
                min={0}
                step="0.01"
                value={state.suggestedDonationValue}
                onChange={(e) => patch({ suggestedDonationValue: e.target.value })}
                placeholder="Valor sugerido por sessão (R$)"
                aria-label="Valor sugerido por sessão (R$)"
              />
            )}
          </div>
        </EditorField>
      )}

      {/* Cobrança detalhada: aparece se `paga` OU já houver billingText
          (T4.0d — não esconder texto já digitado). */}
      {(isPaid || state.billingText) && (
        <EditorField
          fieldId="billingText"
          state={state}
          label="Detalhes de cobrança"
          error={errors.billingText}
        >
          <ContentEditor
            value={state.billingText}
            onChange={(text) => patch({ billingText: text })}
            label="Texto descritivo sobre cobrança"
            minHeight={100}
            maxLength={EDITOR_TEXT_LIMITS.billingText[1]}
            placeholder="Ex: Pagamento via PIX após cada sessão, Mensalidade com desconto para trimestre"
          />
        </EditorField>
      )}
    </div>
  );
}
