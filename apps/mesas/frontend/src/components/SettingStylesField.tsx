import React, { useState, useEffect, useMemo } from 'react';
import '../styles/SettingStylesField.css';

interface SettingStylesFieldProps {
  settingName: string;
  settingStyles: string[];
  onSettingNameChange: (value: string) => void;
  onSettingStylesChange: (styles: string[]) => void;
  selectedScenarioName?: string | null;
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
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  // CORREÇÃO DT-06: Estado para erro de API
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // CORREÇÃO DT-21: Usar Set para verificação de duplicatas sem causar re-render
  const selectedStylesSet = useMemo(() => new Set(settingStyles), [settingStyles]);

  useEffect(() => {
    // CORREÇÃO DT-06: Resetar erro ao mudar o cenário
    setSuggestionError(null);

    if (!settingName || settingName.trim().length < 3) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    // CORREÇÃO DT-07: Adicionar loading state
    setIsLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/v1/settings/suggest-styles?setting=${encodeURIComponent(settingName.trim())}`
        );

        if (response.ok) {
          const data = await response.json();
          const allStyles = data.suggestions.flatMap((s: StyleSuggestion) => s.suggested_styles);
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
  }, [settingName, selectedStylesSet]);

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

  return (
    <div className="setting-styles-field">
      <div className="form-group">
        <label htmlFor="setting-name">
          Cenário <span className="optional">(opcional)</span>
        </label>
        
        {selectedScenarioName ? (
          <div className="selected-scenario-display">
            <span className="scenario-selected-badge">{selectedScenarioName}</span>
            <p className="form-hint">
              Cenário selecionado na etapa anterior. Para alterar, vá para "Sistema e Cenário".
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
              placeholder="Ex: Forgotten Realms, Eberron, Ravenloft"
              // CORREÇÃO DT-10: Adicionar maxLength
              maxLength={MAX_SETTING_LENGTH}
            />
            <p className="form-hint">
              Digite o nome do cenário para receber sugestões de estilos automaticamente.
            </p>
          </>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="setting-styles">
          Estilos/Temáticas <span className="optional">(opcional)</span>
        </label>

        {/* CORREÇÃO DT-23: Indicação visual quando campo está vazio */}
        {settingStyles.length === 0 && !isLoadingSuggestions && suggestions.length === 0 && (
          <p className="form-hint" style={{ fontStyle: 'italic', color: '#95a5a6' }}>
            Nenhum estilo selecionado. Digite um cenário acima para ver sugestões.
          </p>
        )}

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

        {/* CORREÇÃO DT-09: Mostrar aviso quando atingir o limite */}
        {settingStyles.length >= MAX_STYLES_COUNT && (
          <p className="form-hint" style={{ color: '#f39c12' }}>
            Limite máximo de {MAX_STYLES_COUNT} estilos atingido.
          </p>
        )}

        {/* CORREÇÃO DT-07: Mostrar loading state */}
        {isLoadingSuggestions && (
          <div className="suggestions-loading">
            Buscando sugestões...
          </div>
        )}

        {/* CORREÇÃO DT-06: Mostrar erro de API */}
        {suggestionError && !isLoadingSuggestions && (
          <div className="suggestions-error" style={{ 
            padding: '0.75rem', 
            background: '#fee', 
            border: '1px solid #fcc',
            borderRadius: '6px',
            color: '#c33',
            fontSize: '0.9rem',
            marginTop: '0.5rem'
          }}>
            {suggestionError}
          </div>
        )}

        {suggestions.length > 0 && !isLoadingSuggestions && !suggestionError && (
          <div className="suggestions-container">
            <span className="suggestions-label">Sugestões baseadas no cenário:</span>
            <div className="suggestions-list">
              {suggestions.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => handleAddStyle(style)}
                  className="suggestion-button"
                  // CORREÇÃO DT-09: Desabilitar botão se limite atingido
                  disabled={settingStyles.length >= MAX_STYLES_COUNT}
                  style={settingStyles.length >= MAX_STYLES_COUNT ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="form-hint">
          Ex: Horror Cósmico, Investigação, Dungeon Crawl, Político, Sandbox
        </p>
      </div>
    </div>
  );
};
