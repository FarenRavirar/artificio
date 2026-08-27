import React, { useState, useEffect, useMemo } from 'react';
import '../styles/SettingStylesField.css';

interface SettingStylesFieldProps {
  settingName: string;
  settingStyles: string[];
  onSettingNameChange: (value: string) => void;
  onSettingStylesChange: (styles: string[]) => void;
  selectedScenarioName?: string | null;
  /** Subgêneros do cenário escolhido no catálogo (`subgenres` da API de
   *  cenários). São a fonte primária de sugestão: 94% dos 118 cenários têm ao
   *  menos um (medido 2026-08-27), contra 0 de 25 conhecidos pela tabela de
   *  `suggest-styles`. Ver comentário do effect abaixo. */
  selectedScenarioSubgenres?: string[];
}

interface StyleSuggestion {
  setting_name: string;
  suggested_styles: string[];
}

// CORREÇÃO DT-10: Limite máximo de caracteres para o cenário
const MAX_SETTING_LENGTH = 100;
// CORREÇÃO DT-09: Limite máximo de estilos selecionados
const MAX_STYLES_COUNT = 10;

export const SettingStylesField: React.FC<SettingStylesFieldProps> = ({
  settingName,
  settingStyles,
  onSettingNameChange,
  onSettingStylesChange,
  selectedScenarioName = null,
  selectedScenarioSubgenres = [],
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  // CORREÇÃO DT-06: Estado para erro de API
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  // Entrada manual: o catálogo de sugestões não cobre tudo, e o mestre precisa
  // conseguir escrever o estilo da mesa dele mesmo quando nada é sugerido.
  const [styleDraft, setStyleDraft] = useState('');

  // CORREÇÃO DT-21: Usar Set para verificação de duplicatas sem causar re-render
  const selectedStylesSet = useMemo(() => new Set(settingStyles), [settingStyles]);

  // Termo de consulta: o cenário ESCOLHIDO no catálogo tem precedência sobre o
  // texto livre. Antes o effect só olhava `settingName`, que fica vazio quando
  // há cenário do catálogo selecionado — e aí o campo não sugeria nada, nunca,
  // enquanto exibia "Digite um cenário acima" sem existir campo para digitar.
  // (achado do mantenedor 2026-08-27: "a parte de estilos/temáticas está zero
  // funcionando"; medido no beta: API respondendo 200 para "Forgotten Realms" e
  // a tela em branco com "2300 AD" selecionado.)
  const lookupName = (selectedScenarioName || settingName || '').trim();

  useEffect(() => {
    // Todos os setState dentro do timer (debounce) — fora do corpo síncrono do
    // effect, evitando cascading render (react-hooks/set-state-in-effect).
    const timer = setTimeout(async () => {
      setSuggestionError(null);

      if (lookupName.length < 3) {
        setSuggestions([]);
        setIsLoadingSuggestions(false);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(
          `/api/v1/settings/suggest-styles?setting=${encodeURIComponent(lookupName)}`
        );

        if (response.ok) {
          const data = await response.json();
          const raw = Array.isArray(data?.suggestions) ? data.suggestions : [];
          const allStyles = raw.flatMap((s: StyleSuggestion) =>
            Array.isArray(s?.suggested_styles) ? s.suggested_styles : []
          );
          const uniqueStyles = Array.from(new Set(allStyles)).filter(
            (style): style is string => typeof style === 'string' && !selectedStylesSet.has(style)
          );
          setSuggestions(uniqueStyles);
          setSuggestionError(null);
        } else {
          // CORREÇÃO DT-06: Tratar erro de resposta não-ok
          setSuggestions([]);
          setSuggestionError('Não foi possível buscar sugestões no momento.');
        }
      } catch (error) {
        // CORREÇÃO DT-06: Tratar erro de rede
        console.error('Erro ao buscar sugestões:', error);
        setSuggestions([]);
        setSuggestionError('Erro ao conectar com o servidor.');
      } finally {
        // CORREÇÃO DT-07: Desativar loading state
        setIsLoadingSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [lookupName, selectedStylesSet]);

  // Os subgêneros do cenário do catálogo entram ANTES das sugestões da API e
  // sem esperar rede: são o dado que o próprio cenário já carrega, e cobrem 94%
  // do catálogo (medido) contra 0/25 da tabela de `suggest-styles`.
  const offeredStyles = useMemo(() => {
    const fromScenario = (selectedScenarioSubgenres ?? []).filter(
      (style): style is string => typeof style === 'string' && style.trim().length > 0
    );
    return Array.from(new Set([...fromScenario, ...suggestions])).filter(
      (style) => !selectedStylesSet.has(style)
    );
  }, [selectedScenarioSubgenres, suggestions, selectedStylesSet]);

  const handleAddStyle = (style: string) => {
    // CORREÇÃO DT-13: Validar duplicata antes de adicionar
    if (settingStyles.includes(style)) {
      return;
    }

    // CORREÇÃO DT-09: Validar limite máximo
    if (settingStyles.length >= MAX_STYLES_COUNT) {
      return;
    }

    onSettingStylesChange([...settingStyles, style]);
    
    // CORREÇÃO DT-14: Remover sugestão após adicionar
    setSuggestions((prev) => prev.filter((s) => s !== style));
  };

  const handleRemoveStyle = (style: string) => {
    onSettingStylesChange(settingStyles.filter((s) => s !== style));
  };

  // Estilo digitado à mão: sem isto o campo depende inteiramente de a sugestão
  // existir, e mesa com temática fora do catálogo fica sem nenhuma tag.
  const handleAddDraft = () => {
    const value = styleDraft.trim();
    if (!value) return;
    handleAddStyle(value);
    setStyleDraft('');
  };

  return (
    <div className="setting-styles-field">
      <div className="form-group">
        {/* O rótulo "Cenário" foi REMOVIDO daqui (2026-08-27): o editor unificado
            já rotula o campo do catálogo logo acima, no mesmo painel, e ter dois
            "Cenário (opcional)" empilhados fazia o mestre achar que eram o mesmo
            campo repetido. Aqui só resta a ambientação de texto livre — o caso
            de cenário que NÃO está no catálogo. O `EditorField` que envolve este
            componente (IdentityPart.tsx) já dá o rótulo "Ambientação e estilos".
            Também saiu o texto "vá para Sistema e Cenário": era instrução do
            fluxo antigo em etapas, que o editor unificado substituiu — não há
            mais etapa nenhuma para onde ir. */}
        {selectedScenarioName ? (
          <div className="selected-scenario-display">
            <span className="scenario-selected-badge">{selectedScenarioName}</span>
            <p className="form-hint">
              Cenário do catálogo — os estilos abaixo já vêm dele.
            </p>
          </div>
        ) : (
          <>
            <input
              id="setting-name"
              type="text"
              className="form-input"
              value={settingName}
              onChange={(e) => onSettingNameChange(e.target.value)}
              placeholder="Ex: mundo próprio, homebrew, ambientação autoral"
              // CORREÇÃO DT-10: Adicionar maxLength
              maxLength={MAX_SETTING_LENGTH}
            />
            <p className="form-hint">
              Só para ambientação fora do catálogo. Se o cenário está no catálogo,
              use a busca acima.
            </p>
          </>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="setting-styles">
          Estilos/Temáticas <span className="optional">(opcional — aparece como filtro/tag no catálogo)</span>
        </label>

        {settingStyles.length > 0 && (
          <div className="styles-chips">
            {settingStyles.map((style, index) => (
              // CORREÇÃO DT-08: Usar índice + estilo como key para evitar problemas com duplicatas
              <span key={`${index}-${style}`} className="style-chip">
                {style}
                <button
                  type="button"
                  onClick={() => handleRemoveStyle(style)}
                  className="chip-remove"
                  // CORREÇÃO DT-11: Adicionar aria-label para acessibilidade
                  aria-label={`Remover estilo ${style}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Entrada manual (2026-08-27). Antes, a ÚNICA forma de pôr um estilo era
            clicar numa sugestão — e a sugestão só existia se a tabela
            `suggest-styles` conhecesse o cenário, o que não acontecia para
            nenhum dos 25 cenários testados. Resultado medido: o campo não
            funcionava para ninguém. Digitar é o caminho que não depende de
            catálogo nenhum. */}
        {settingStyles.length < MAX_STYLES_COUNT && (
          <div className="style-draft-row">
            <input
              id="setting-styles"
              type="text"
              className="form-input"
              value={styleDraft}
              onChange={(e) => setStyleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Enter num input dentro de <form> submete a página; aqui ele
                  // adiciona a tag, que é o que o mestre espera ao digitar.
                  e.preventDefault();
                  handleAddDraft();
                }
              }}
              placeholder="Ex: Horror Cósmico, Investigação, Dungeon Crawl"
              maxLength={MAX_SETTING_LENGTH}
              aria-label="Adicionar estilo ou temática"
            />
            <button
              type="button"
              className="style-draft-add"
              onClick={handleAddDraft}
              disabled={!styleDraft.trim()}
            >
              Adicionar
            </button>
          </div>
        )}

        {/* CORREÇÃO DT-09: Mostrar aviso quando atingir o limite */}
        {settingStyles.length >= MAX_STYLES_COUNT && (
          <p className="form-hint" style={{ color: 'var(--warning, #f39c12)' }}>
            Limite máximo de {MAX_STYLES_COUNT} estilos atingido.
          </p>
        )}

        {/* CORREÇÃO DT-07: Mostrar loading state */}
        {isLoadingSuggestions && (
          <div className="suggestions-loading">
            Buscando sugestões...
          </div>
        )}

        {/* Erro pelos tokens do tema, não hex fixo: `#fee`/`#fcc`/`#c33` eram
            claros fixos que ficavam ilegíveis no tema escuro — mesmo defeito já
            corrigido no aviso de campo vazio em 2026-08-26. */}
        {suggestionError && !isLoadingSuggestions && (
          <p className="form-hint" style={{ color: 'var(--fg-muted)' }}>
            {suggestionError} Você ainda pode digitar os estilos acima.
          </p>
        )}

        {offeredStyles.length > 0 && !isLoadingSuggestions && (
          <div className="suggestions-container">
            <span className="suggestions-label">
              {selectedScenarioName
                ? `Sugestões de ${selectedScenarioName}:`
                : 'Sugestões baseadas na ambientação:'}
            </span>
            <div className="suggestions-list">
              {offeredStyles.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => handleAddStyle(style)}
                  className="suggestion-button"
                  // CORREÇÃO DT-09: Desabilitar botão se limite atingido
                  disabled={settingStyles.length >= MAX_STYLES_COUNT}
                  style={settingStyles.length >= MAX_STYLES_COUNT ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  + {style}
                </button>
              ))}
            </div>
          </div>
        )}

        {settingStyles.length === 0 && offeredStyles.length === 0 && !isLoadingSuggestions && (
          /* Cor pelo token, não hex fixo (achado do mantenedor, 2026-08-26):
             `#95a5a6` era cinza hardcoded que ignorava o tema e media 2.28:1 no
             light — reprova o mínimo 4.5:1 de WCAG AA para texto normal. */
          <p className="form-hint" style={{ fontStyle: 'italic', color: 'var(--fg-muted)' }}>
            Nenhum estilo ainda. Digite acima, ou escolha um cenário do catálogo
            para receber sugestões.
          </p>
        )}
      </div>
    </div>
  );
};
