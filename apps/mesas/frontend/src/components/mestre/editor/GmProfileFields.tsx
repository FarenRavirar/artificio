/**
 * Campos do editor de perfil de mestre (spec 099, fase B).
 *
 * Arquivo consolidado: os seis campos desta fase viviam em arquivos próprios
 * dentro de `editor/` (43–153 linhas cada) — pequenos demais para um arquivo
 * por campo. A página (`ProfileEditPage`) monta cada campo separadamente,
 * então cada componente segue exportado com o MESMO nome, props e
 * comportamento — só a casa mudou. Os conversores de preço (B2) vieram junto
 * por terem um único consumidor neste arquivo (`ClosedGroupPriceField`).
 *
 * Organização: uma seção `// ── Nome ──` por campo, na ordem do formulário.
 */

import { useRef, useState } from 'react';
import { Button, Field, Select, TextInput, Textarea } from '@artificio/ui';
import { TagInput } from '../../TagInput';
import { SystemPicker } from '../../SystemPicker';
import { useSystemsSearch } from '../../../hooks/useSystemsSearch';
import { useResolvedSystemNodes } from '../../../hooks/useResolvedSystemNodes';

/** Estável de propósito: `[]` literal a cada render trocaria a identidade da prop. */
const SEM_SISTEMAS: readonly string[] = [];
import { MarkdownEditor } from '../../MarkdownEditor';
import { normalizeSellingPoints } from '../../../hooks/useMestre';
import { useProfileContext } from '../../../contexts/useProfileContext';
import { BioAttributeSuggestions } from './BioAttributeSuggestions';
import { ProfileFieldRow } from './ProfileFieldRow';
// Vocabulário fechado de `selling_points` (spec 099 §2.2): o dicionário vive
// no módulo `../sellingPointIcons` (fonte única entre exibição e editor —
// módulo `.ts` porque `react-refresh/only-export-components` proíbe exportar
// constante de arquivo de componente).
import {
  SELLING_POINT_ICON_KEYS,
  SELLING_POINT_ICON_LABELS,
  type SellingPoint,
} from '../sellingPointIcons';
// Constantes de ganho e helpers puros (mesma regra do lint): vivem em
// `./profileEditorDomain` — ver docstring lá.
import {
  RECOMMENDED_GAIN,
  isValidSellingPoint,
  reaisParaCentavos,
  centavosParaReais,
} from './profileEditorDomain';

// ── TaglineField ──

// `readonly`: props de componente são entrada, nunca destino de escrita — o
// tipo passa a dizer isso (achado do Sonar, PR #306).
//
// Sem `onChange`: quem persiste o slogan é o Salvar do modal, via `toPatch` do
// `ProfileFieldRow` (D1/D2). A prop sobreviveu à conversão em linha+modal sem
// nunca ser chamada — prop morta que finge contrato vivo, e o próximo a ler o
// tipo suporia que digitar dispara alguma coisa (achado do Sonar, PR #306).
interface TaglineFieldProps {
  readonly value: string;
  readonly error?: string;
}

/**
 * Campo de slogan do mestre (spec 099, B1).
 *
 * Replica o padrão `EditorField` + `RECOMMENDED_GAIN` do editor de mesa
 * (spec 096): nível marcado via `data-ob` (gancho cruzado pelos testes contra
 * o registro de validação) + frase do ganho no nível recomendado. Primitivos
 * do pacote (`Field`/`TextInput`), altura da escala `artificio-control-md`
 * (default do `TextInput`), espaçamento só de `--space-1..6` (gap-2).
 * `maxLength` 200 alinhado ao corte do PUT (`safeTagline`, gmPanel.ts).
 */
export function TaglineField({ value, error }: TaglineFieldProps) {
  return (
    // Linha + modal (spec 100, D1/T4.1): era campo inline com autosave por
    // digitação. Quem persiste agora é o Salvar do modal, via `toPatch` — ver
    // ProfileFieldRow sobre por que escrever durante a digitação quebraria o
    // descarte de D2.
    <ProfileFieldRow<string>
      label="Slogan"
      displayValue={value.trim() || null}
      value={value}
      toPatch={(draft) => ({ tagline: draft.trim() || null })}
      obLevel="recommended"
      fieldName="tagline"
      hint={`Recomendado — ${RECOMMENDED_GAIN.tagline}.`}
    >
      {(draft, setDraft) => (
        <Field
          id="gm-tagline"
          label="Slogan"
          hint="Uma frase que resume o que o jogador encontra nas suas mesas."
          error={error}
        >
          <TextInput
            id="gm-tagline"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            invalid={!!error}
            placeholder="Ex: Aventuras épicas com regras claras e histórias imersivas"
            // B7: o `Field` renderiza hint/erro no `<p id="${id}-description">`
            // mas não associa o controle — a associação é trabalho do formulário.
            aria-describedby="gm-tagline-description"
          />
        </Field>
      )}
    </ProfileFieldRow>
  );
}

// ── PromoBadgeField ──

interface PromoBadgeFieldProps {
  value: string | null | undefined;
}

/**
 * Campo da faixa promocional (spec 099, B5).
 *
 * Um campo de texto, `maxLength` 120 — mesmo corte do PUT (`safePromoBadgeText`,
 * gmPanel.ts:260). Nível OPCIONAL (spec §8): promocional, alcance menor — sem
 * frase de ganho (regra 3 de §8).
 *
 * A exibição JÁ existe: a faixa renderiza no topo do `MestreHero`
 * (`hero-promo-badge`, MestreHero.tsx:67-72) — este campo é só a porta de
 * entrada. Posição junto do slogan no formulário, porque os dois dividem a
 * dobra do perfil (spec §2.1).
 *
 * Gravação direta via `updateGm` (PUT /api/v1/gm/profile) — mesma justificativa
 * do ProfileTagsSection: teste da gravação no teste do componente + A9.
 */
export function PromoBadgeField({ value }: PromoBadgeFieldProps) {
  const { updateGm } = useProfileContext();

  return (
    <div className="flex flex-col gap-2" data-ob="optional" data-field="promo_badge_text">
      <Field
        id="gm-promo-badge-text"
        label="Faixa promocional (opcional)"
        hint="Uma frase curta no topo do seu perfil público."
      >
        <TextInput
          id="gm-promo-badge-text"
          value={value ?? ''}
          onChange={(e) => updateGm({ promo_badge_text: e.target.value || null })}
          maxLength={120}
          placeholder="Ex: Mesas novas toda sexta-feira"
          // B7: associação ao hint do `Field` (ver TaglineField).
          aria-describedby="gm-promo-badge-text-description"
        />
      </Field>
    </div>
  );
}

// ── ProfileTagsSection ──

interface ProfileTagsSectionProps {
  readonly specialties: string[];
  readonly languages: string[];
  readonly badges: string[];
}

/**
 * Editor de `specialties`, `languages` e `badges` (spec 099, B3).
 *
 * Os três são `Generated<string[]>` — texto livre, sem vocabulário fechado
 * (spec §2.2) — e o `TagInput` do mesas é o encaixe direto (plan §B "o que
 * reusar": o pacote não tem tag input, armadilha 3).
 *
 * Gravação: cada TagInput grava direto via `updateGm` (PUT /api/v1/gm/profile,
 * uma chamada por mudança — mesmo padrão de escrita da TabMestre). Diferente
 * do `TaglineField`/`ClosedGroupSection` (B1/B2), que devolvem `onChange` e
 * deixam a página colar no `updateGm`, aqui a conexão vive DENTRO do
 * componente: a task exige teste da gravação via `updateGm` no teste do
 * próprio componente, e A9 ("sem a conexão do campo, o teste falha") só é
 * demonstrável se a conexão existir no componente. O valor continua vindo de
 * props (`gmProfile`), então o componente segue controlado e sem estado local.
 *
 * Níveis (§8): `specialties`/`languages` recomendados com frase do ganho;
 * `badges` opcional sem frase (frase em campo que não muda a decisão vira
 * ruído — regra 3 de §8).
 */
export function ProfileTagsSection({ specialties, languages, badges }: ProfileTagsSectionProps) {
  const { updateGm } = useProfileContext();

  return (
    <div className="flex flex-col gap-4">
      {/* Especialidades e idiomas viraram linha + modal (D1/T4.1). `badges`
          segue inline logo abaixo: D1 nomeia quatro campos curtos, e ele não é
          um deles. */}
      <ProfileFieldRow<string[]>
        label="Especialidades"
        displayValue={specialties.length > 0 ? specialties.join(', ') : null}
        value={specialties}
        toPatch={(draft) => ({ specialties: draft })}
        obLevel="recommended"
        fieldName="specialties"
        hint={`Recomendado — ${RECOMMENDED_GAIN.specialties}.`}
      >
        {(draft, setDraft) => (
          <Field
            id="gm-specialties"
            label="Especialidades"
            hint="Estilos e temas que você mestra bem. Digite e pressione Enter para adicionar."
          >
            <TagInput
              id="gm-specialties"
              ariaLabel="Especialidades"
              value={draft}
              onChange={setDraft}
              placeholder="Ex: Horror, intriga política"
              // B7: associação ao hint do `Field` (ver TaglineField).
              describedBy="gm-specialties-description"
            />
          </Field>
        )}
      </ProfileFieldRow>

      <ProfileFieldRow<string[]>
        label="Idiomas"
        displayValue={languages.length > 0 ? languages.join(', ') : null}
        value={languages}
        toPatch={(draft) => ({ languages: draft })}
        obLevel="recommended"
        fieldName="languages"
        hint={`Recomendado — ${RECOMMENDED_GAIN.languages}.`}
      >
        {(draft, setDraft) => (
          <Field
            id="gm-languages"
            label="Idiomas"
            hint="Idiomas em que você mestra. Digite e pressione Enter para adicionar."
          >
            <TagInput
              id="gm-languages"
              ariaLabel="Idiomas"
              value={draft}
              onChange={setDraft}
              placeholder="Ex: Português, Inglês"
              // B7: associação ao hint do `Field` (ver TaglineField).
              describedBy="gm-languages-description"
            />
          </Field>
        )}
      </ProfileFieldRow>
      {/* `badges` segue inline: campo opcional, sem frase de ganho (§8). */}
      <div className="flex flex-col gap-2" data-ob="optional" data-field="badges">
      </div>

      <div className="flex flex-col gap-2" data-ob="optional" data-field="badges">
        <Field
          id="gm-badges"
          label="Selos"
          hint="Destaques e conquistas que aparecem no seu perfil. Digite e pressione Enter para adicionar."
        >
          <TagInput
            id="gm-badges"
            ariaLabel="Selos"
            value={badges}
            onChange={(next) => updateGm({ badges: next })}
            placeholder="Ex: Streamer, Autor de aventuras"
            // B7: associação ao hint do `Field` (ver TaglineField).
            describedBy="gm-badges-description"
          />
        </Field>
      </div>
    </div>
  );
}

// ── SellingPointsEditor ──

interface SellingPointsEditorProps {
  /** Cru do banco (JSONB): pode ser `{}` (achado A1) — normalizado na entrada. */
  value: unknown;
}

/**
 * Editor de `selling_points` (spec 099, B4).
 *
 * - Ícone SEMPRE por seleção: `Select` com as 14 chaves de
 *   `SELLING_POINT_ICONS` (dicionário fechado, spec §2.2) — nunca input livre.
 * - Item inválido (título/descrição vazios) fica visível com erro e NÃO é
 *   enviado: o backend descarta em silêncio via `.filter(isSellingPoint)`
 *   (gmPanel.ts), o formulário não pode deixar o estado inválido chegar lá.
 *   O `updateGm` recebe sempre o array inteiro com os itens válidos.
 * - Rascunho local (o mesmo padrão de `bioLong` na TabMestre): item em
 *   edição precisa continuar visível mesmo sem estar salvo.
 *
 * Gravação direta via `updateGm` (PUT /api/v1/gm/profile) — mesma justificativa
 * do ProfileTagsSection: teste da gravação no teste do componente + A9.
 */
export function SellingPointsEditor({ value }: SellingPointsEditorProps) {
  const { updateGm } = useProfileContext();
  const [items, setItems] = useState<SellingPoint[]>(() => normalizeSellingPoints(value));

  // Quantos itens VÁLIDOS já estavam salvos quando o editor montou. Serve para
  // distinguir os dois casos que o `.filter` confundia (achado de review, #297):
  // item novo ainda em branco é rascunho (não grava, não apaga nada), mas item
  // JÁ SALVO que ficou temporariamente inválido — o mestre apagou o título para
  // reescrever — não pode sumir do array enviado. Sem esta guarda, uma pausa de
  // 500ms no meio da edição persistia a exclusão de um ponto que o mestre nunca
  // mandou remover, e o cartão continuava visível como rascunho.
  const salvosNoMonte = useRef(normalizeSellingPoints(value).filter(isValidSellingPoint).length);

  const commit = (next: SellingPoint[], opcoes?: { removendo?: boolean }) => {
    setItems(next);
    const validos = next.filter(isValidSellingPoint);

    // Remoção explícita sempre grava — é o mestre pedindo. Fora dela, gravar um
    // array MENOR do que o salvo significa que uma edição em curso derrubou um
    // item válido: suspende a gravação até ele voltar a ser válido.
    if (!opcoes?.removendo && validos.length < salvosNoMonte.current) return;

    salvosNoMonte.current = validos.length;
    updateGm({ selling_points: validos });
  };

  const updateItem = (index: number, patch: Partial<SellingPoint>) => {
    commit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    commit(items.filter((_, i) => i !== index), { removendo: true });
  };

  const addItem = () => {
    // Ícone default `sparkles` (fallback do contrato, spec §2.2). O item
    // nasce inválido (título/descrição vazios) e só é enviado quando
    // preenchido — por isso aqui só o rascunho muda, sem `updateGm`
    // (nenhum item válido mudou; gravar seria ruído).
    setItems([...items, { icon: 'sparkles', title: '', description: '' }]);
  };

  return (
    // B6: `data-field` do recomendado casa com a chave do `RECOMMENDED_GAIN`
    // (camelCase, padrão da missão) — é o gancho do teste cruzado. Os campos
    // opcionais seguem o nome do banco (snake_case) por serem outra convenção
    // (gancho de nível, não chave de registro).
    <div className="flex flex-col gap-2" data-ob="recommended" data-field="sellingPoints">
      <div className="flex flex-col gap-4">
        {items.map((item, index) => {
          const itemError = isValidSellingPoint(item)
            ? undefined
            : 'Título e descrição são obrigatórios para salvar o destaque.';
          const controlId = (suffix: string) => `gm-selling-point-${index}-${suffix}`;
          return (
            <div key={index} className="flex flex-col gap-2" data-testid={`selling-point-${index}`}>
              <div className="flex flex-wrap items-start gap-2">
                <Field id={controlId('icon')} label="Ícone">
                  <Select
                    id={controlId('icon')}
                    value={item.icon}
                    onChange={(e) => updateItem(index, { icon: e.target.value })}
                    aria-label={`Ícone do destaque ${index + 1}`}
                  >
                    {SELLING_POINT_ICON_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {SELLING_POINT_ICON_LABELS[key] ?? key}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  id={controlId('title')}
                  label="Título"
                  error={itemError}
                >
                  <TextInput
                    id={controlId('title')}
                    value={item.title}
                    onChange={(e) => updateItem(index, { title: e.target.value })}
                    invalid={!!itemError}
                    placeholder="Ex: Campanhas épicas"
                    // B7: o `<p>` de erro só existe quando há erro — a
                    // associação acompanha (sem erro, sem atributo).
                    aria-describedby={itemError ? `${controlId('title')}-description` : undefined}
                  />
                </Field>

                <Button
                  id={controlId('remove')}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remover destaque ${index + 1}`}
                  onClick={() => removeItem(index)}
                >
                  Remover
                </Button>
              </div>

              <Field id={controlId('description')} label="Descrição">
                <Textarea
                  id={controlId('description')}
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  invalid={!!itemError}
                  placeholder="Ex: Histórias com começo, meio e fim em 4 a 6 sessões."
                  // B7: `itemError` cobre o par título+descrição e é renderizado
                  // uma vez só, no `Field` do título. A descrição fica `invalid`
                  // sem apontar para a explicação — leitor de tela anunciava
                  // "inválido" sem dizer por quê (achado de review, PR #297).
                  // Aponta para o MESMO `<p>`, que é onde o texto existe.
                  aria-describedby={itemError ? `${controlId('title')}-description` : undefined}
                />
              </Field>

              <Field id={controlId('highlight')} label="Destaque (opcional)">
                <TextInput
                  id={controlId('highlight')}
                  value={item.highlight ?? ''}
                  onChange={(e) => updateItem(index, { highlight: e.target.value || undefined })}
                  placeholder="Ex: Sessão zero gratuita"
                />
              </Field>
            </div>
          );
        })}
      </div>

      <div>
        <Button id="gm-selling-point-add" type="button" variant="secondary" size="sm" onClick={addItem}>
          Adicionar ponto forte
        </Button>
      </div>

      <p className="text-[length:var(--text-label)] leading-[var(--leading-label)] opacity-75">Recomendado — {RECOMMENDED_GAIN.sellingPoints}.</p>
    </div>
  );
}

// ── ClosedGroupPriceField ──

interface ClosedGroupPriceFieldProps {
  value: number | null;
  onChange: (cents: number | null) => void;
  error?: string;
}

/**
 * Preço mínimo de grupo fechado (spec 099, B2).
 *
 * Input em REAIS, gravado em CENTAVOS: a escrita é o inverso exato de
 * `formatPriceBRL` (MestreClosedGroupSection.tsx:15) — `reaisParaCentavos`
 * trata "10" → 1000, "10,50" → 1050 e vazio/inválido → null (o backend só
 * aceita inteiro não-negativo). Estado local, mesmo padrão do campo de bio
 * da TabMestre: o texto digitado não é reformatado pelo valor externo a cada
 * autosave.
 */
export function ClosedGroupPriceField({ value, onChange, error }: ClosedGroupPriceFieldProps) {
  const [text, setText] = useState(() => centavosParaReais(value));

  return (
    <Field
      id="gm-closed-group-price"
      label="Preço mínimo (R$)"
      hint="Valor mínimo por sessão. Mostrado como “a partir de” na página pública."
      error={error}
    >
      <TextInput
        id="gm-closed-group-price"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onChange(reaisParaCentavos(next));
        }}
        invalid={!!error}
        placeholder="Ex: 10,50"
        // B7: hint sempre presente e erro no mesmo `<p>` (`${id}-description`) —
        // a associação é fixa (ver TaglineField).
        aria-describedby="gm-closed-group-price-description"
      />
    </Field>
  );
}

// ── ClosedGroupSection ──

/**
 * Seção de grupos fechados no editor de perfil (spec 099, B2).
 *
 * 4 campos + liga/desliga, todos gravados via PUT /api/v1/gm/profile com uma
 * chamada por campo (padrão atual da TabMestre):
 * - `closed_group_enabled`: toggle `<Button>` + `aria-pressed` — o pacote não
 *   exporta checkbox/toggle (plan §B, armadilha 3); o padrão de botão com
 *   `aria-pressed` é o do GmReviewPanel (packages/ui) e do `ToggleButton` do
 *   editor de mesa (EditorField.tsx);
 * - `closed_group_systems`: `SystemPicker` em modo multi — MESMO mecanismo do
 *   seletor de sistemas já usado nesta página ("Sistemas que Mestra"): grava
 *   sempre UUID (`selectedIds`), nunca nome — o backend filtra por
 *   `/^[0-9a-fA-F-]{36}$/`;
 * - `closed_group_description`: `MarkdownEditor` (mesmo adaptador da bio) — a
 *   página pública renderiza o campo como markdown (MarkdownContent);
 * - `closed_group_min_price_cents`: `ClosedGroupPriceField` (reais → centavos).
 *
 * Nível "opcional condicional" (spec §8): `data-ob="optional"`, sem frase de
 * ganho — frase em campo que não muda a decisão vira ruído (regra 3 de §8).
 */

export interface ClosedGroupEditorValue {
  enabled: boolean;
  systems: string[];
  description: string;
  min_price_cents: number | null;
}

interface ClosedGroupSectionProps {
  value: ClosedGroupEditorValue;
  onChange: (patch: Partial<ClosedGroupEditorValue>) => void;
}

export function ClosedGroupSection({ value, onChange }: ClosedGroupSectionProps) {
  // G5b (spec 099): este é o SEGUNDO seletor de sistemas da aba Mestre. Tirar
  // o catálogo inteiro só do "Sistemas que mestra" não teria adiantado nada —
  // esta seção continuaria baixando os 487.965 bytes na mesma tela, e a
  // economia medida seria zero para quem abre a aba.
  const { fetchSystemOptions, fetchChildOptions } = useSystemsSearch();
  // A resolução dos nomes dos ids salvos vive no `useResolvedSystemNodes` (G6):
  // era mecânica idêntica à do `UserSystemsSelector` — ref para não reentrar,
  // chave estável da seleção, aviso amarrado à seleção atual. Extraída depois
  // de o Sonar medir a duplicação na PR #304, não por antecipação.
  // Seleção VAZIA quando o grupo está desligado: o seletor só é renderizado sob
  // `value.enabled` (abaixo), então resolver os ids com ele fechado dispara um
  // `fetchSystemsByIds` cujo resultado ninguém vê — requisição paga por nada, em
  // toda montagem da aba. Achado do CodeRabbit na PR #304.
  const idsParaResolver = value.enabled ? value.systems : SEM_SISTEMAS;
  const { nodes: visibleSelectedNodes, failed: resolveFailed, retry: retryResolve } =
    useResolvedSystemNodes(idsParaResolver);

  return (
    <section className="form-section">
      <h2>Grupos fechados</h2>
      <p className="section-description">
        Ofereça campanhas exclusivas para grupos de amigos que já se conhecem.
      </p>

      <div className="flex flex-col gap-3">
        <div data-ob="optional" data-field="closed_group_enabled">
          {/* Controle de duas posições sobre o `Button` do pacote: `aria-pressed`
              comunica o estado a leitores de tela e a variante (primary/
              secondary) comunica ao olho — padrão GmReviewPanel/ToggleButton. */}
          <Button
            id="gm-closed-group-toggle"
            type="button"
            variant={value.enabled ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={value.enabled}
            onClick={() => onChange({ enabled: !value.enabled })}
          >
            Oferecer mesas para grupos fechados
          </Button>
        </div>

        {value.enabled && (
          <div className="flex flex-col gap-4" data-ob="optional" data-field="closed_group">
            <Field
              id="gm-closed-group-systems-search"
              label="Sistemas aceitos"
              hint="Sistemas que você mestra para grupos fechados. Escolha quantos quiser."
            >
              {/* B7: exceção documentada — o controle aqui é o CatalogTree do
                  pacote (@artificio/catalog-ui), que não aceita prop de
                  aria-describedby (interface medida em CatalogTree.tsx); a
                  associação exigiria mudar o pacote, fora do escopo desta fase.

                  G5b: não há mais estado de "carregando catálogo" antes do
                  campo — nada é baixado até o mestre digitar. O que sumiu daqui
                  foi a espera, não o tratamento de erro: a busca e a resolução
                  de nomes reportam falha onde acontecem. */}
              {resolveFailed && (
                <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--state-danger-fg)]" role="alert">
                  Não foi possível carregar os nomes dos sistemas escolhidos. Eles continuam
                  salvos.{' '}
                  {/* Falha transitória só se recuperava trocando a seleção ou
                      recarregando: o efeito depende de `selectedKey`, que não
                      muda. Achado do Codex na PR #304. */}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={retryResolve}
                  >
                    Tentar de novo
                  </button>
                </p>
              )}
              <SystemPicker
                selectedIds={value.systems}
                selectedNodes={visibleSelectedNodes}
                fetchSystemOptions={fetchSystemOptions}
                fetchChildOptions={fetchChildOptions}
                onSelectionChange={(ids) => onChange({ systems: ids })}
                idPrefix="gm-closed-group-systems"
                mode="multi"
                role="user"
              />
            </Field>

            <div>
              <MarkdownEditor
                value={value.description}
                onChange={(description) => onChange({ description })}
                label="Descrição (opcional)"
                placeholder="Ex: Reúna seus amigos e eu monto a campanha sob medida para o grupo."
                height={140}
                id="gm-closed-group-description"
              />
            </div>

            <ClosedGroupPriceField
              value={value.min_price_cents}
              onChange={(min_price_cents) => onChange({ min_price_cents })}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ── BioLongField ──

interface BioLongFieldProps {
  value: string;
}

/**
 * Bio detalhada do mestre (spec 099 §8): RECOMENDADO, com frase do ganho e
 * `data-ob` (B6). Extraído da TabMestre (ProfileEditPage) para o teste cruzado
 * alcançar o `data-ob` do campo — mesmo markup (`form-group` + MarkdownEditor)
 * e mesma gravação por digitação via `updateGm`, visual preservado.
 *
 * B7: sem hint nem erro (o MarkdownEditor não exibe nenhum dos dois) — por
 * isso o controle não recebe `aria-describedby` (regra: campo sem hint/erro
 * fica de fora).
 */
export function BioLongField({ value }: BioLongFieldProps) {
  const { profile, updateGm } = useProfileContext();
  // Rascunho local, mesmo padrão do estado que vivia na TabMestre: o texto
  // digitado não é reformatado pelo valor externo a cada autosave.
  const [bioLong, setBioLong] = useState(value);

  return (
    <div data-ob="recommended" data-field="bioLong">
      <div className="form-group">
        <label>Bio Detalhada</label>
        <MarkdownEditor
          value={bioLong}
          onChange={(text) => {
            setBioLong(text);
            updateGm({ bio_long: text });
          }}
          label="Bio detalhada"
          placeholder="Conte sobre sua experiência como mestre..."
          height={300}
        />
      </div>
      <BioAttributeSuggestions
        bio={bioLong}
        onConfirm={(candidate) => {
          if (candidate.field === 'experience_years') {
            updateGm({ experience_years: candidate.value });
            return;
          }
          const current = profile?.gm?.[candidate.field] ?? [];
          const normalized = candidate.value.toLocaleLowerCase('pt-BR');
          const exists = current.some((value) => value.toLocaleLowerCase('pt-BR') === normalized);
          if (!exists) updateGm({ [candidate.field]: [...current, candidate.value] });
        }}
      />
      <p className="text-[length:var(--text-label)] leading-[var(--leading-label)] opacity-75">Recomendado — {RECOMMENDED_GAIN.bioLong}.</p>
    </div>
  );
}

// ── ExperienceYearsField ──

interface ExperienceYearsFieldProps {
  readonly value: number | null;
}

/**
 * Anos de experiência do mestre (spec 099 §8): RECOMENDADO, com frase do
 * ganho e `data-ob` (B6). Extraído da TabMestre (ProfileEditPage) pelo mesmo
 * motivo do BioLongField; `defaultValue` preservado do original (campo não
 * controlado, autosave por digitação).
 *
 * B7: sem hint nem erro — fora do `aria-describedby` (mesma regra do
 * BioLongField).
 */
export function ExperienceYearsField({ value }: ExperienceYearsFieldProps) {
  return (
    // Linha + modal (D1/T4.1). O rascunho é STRING, não número: o campo
    // precisa representar "vazio" e estados intermediários da digitação, que
    // `number | null` não distingue de zero. A conversão para o patch é onde a
    // validação mora — e ela é a mesma de antes.
    <ProfileFieldRow<string>
      label="Anos de Experiência"
      displayValue={value == null ? null : String(value)}
      value={value == null ? '' : String(value)}
      toPatch={(draft) => {
        const bruto = draft.trim();
        if (bruto === '') return { experience_years: null };
        const n = Number(bruto);
        // `parseInt(v) || null` transformava o ZERO valido em null (0 e falsy),
        // e ainda aceitava "1.5" (parseInt trunca) e negativos apesar do
        // `min="0"` — o atributo so barra o spinner, nao a digitacao (achado de
        // review, PR #297). Entrada inválida não vira patch nenhum.
        if (!Number.isInteger(n) || n < 0) return {};
        return { experience_years: n };
      }}
      obLevel="recommended"
      fieldName="experienceYears"
      hint={`Recomendado — ${RECOMMENDED_GAIN.experienceYears}.`}
    >
      {(draft, setDraft) => (
        <div className="form-group">
          <label htmlFor="experience_years">Anos de Experiência</label>
          <TextInput
            type="number"
            id="experience_years"
            min="0"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Quantos anos você mestra?"
            className="experience-years-input"
          />
        </div>
      )}
    </ProfileFieldRow>
  );
}
