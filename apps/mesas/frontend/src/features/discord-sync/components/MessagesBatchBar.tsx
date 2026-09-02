import type { DiscordMessage } from '../types';

/**
 * Barra de seleção em lote da aba de mensagens.
 *
 * Extraída do MessagesView porque as ações mudam por MODO e isso concentrava boa parte
 * da ramificação do componente pai (Sonar mediu complexidade cognitiva 37 lá). A regra
 * de negócio inteira cabe aqui: na aba normal o lote ignora; na aba Ignoradas ele
 * reprocessa ou apaga, porque re-ignorar o que já está ignorado não é ação.
 */
type MessagesBatchBarProps = Readonly<{
  /** Mensagens que o modo atual permite selecionar. Barra some quando vazio. */
  selecionaveis: DiscordMessage[];
  /** Subconjunto de fato marcado. */
  selecionadas: DiscordMessage[];
  todasSelecionadas: boolean;
  modoIgnoradas: boolean;
  /** Trava os botões enquanto a operação de lote corre. */
  ocupado: boolean;
  onAlternarTodas: () => void;
  onIgnorar: () => void;
  onReprocessar: () => void;
  onApagar: () => void;
}>;

export function MessagesBatchBar({
  selecionaveis,
  selecionadas,
  todasSelecionadas,
  modoIgnoradas,
  ocupado,
  onAlternarTodas,
  onIgnorar,
  onReprocessar,
  onApagar,
}: MessagesBatchBarProps) {
  if (selecionaveis.length === 0) return null;

  return (
    <div className="flex items-center gap-3 my-3 flex-wrap">
      <label className="flex items-center gap-2 text-white/60 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={todasSelecionadas}
          onChange={onAlternarTodas}
          aria-label="Selecionar todas as mensagens"
          className="h-4 w-4 accent-blue-600"
        />
        Selecionar todas ({selecionaveis.length})
      </label>
      {selecionadas.length > 0 && (
        <>
          <span className="text-white/40 text-sm">{selecionadas.length} selecionada(s)</span>
          {modoIgnoradas ? (
            <>
              <button
                type="button"
                onClick={onReprocessar}
                disabled={ocupado}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {ocupado ? 'Reprocessando...' : `✦ Reprocessar (${selecionadas.length})`}
              </button>
              {/* Destrutivo em vermelho e por último: some do banco, e é o
                  que libera o JSON original para ser reimportado. */}
              <button
                type="button"
                onClick={onApagar}
                disabled={ocupado}
                className="px-4 py-2 bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)] hover:opacity-80 text-sm rounded-lg transition-opacity disabled:opacity-50"
              >
                {ocupado ? 'Apagando...' : `Apagar (${selecionadas.length})`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onIgnorar}
              disabled={ocupado}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {ocupado ? 'Ignorando...' : `Ignorar selecionadas (${selecionadas.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
