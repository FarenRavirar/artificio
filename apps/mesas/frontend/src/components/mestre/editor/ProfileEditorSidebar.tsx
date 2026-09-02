import { memo, useState } from 'react';
import { Button } from '@artificio/ui';
import {
  PROFILE_PARTS,
  profilePartDomId,
  type ProfilePartId,
} from './profileEditorParts';

/**
 * Lateral do editor de perfil de mestre (spec 099, fase G — G1/G3/G4):
 * progresso, as 5 partes com pendências, e a porta para o link oficial.
 *
 * Duplicação deliberada do padrão de `EditorSidebar` (TableEditor.tsx:480-550),
 * registrada e datada em `profileEditorParts.ts` — a G6 compara as duas e
 * decide o que extrair. O editor de mesa não é tocado.
 *
 * `memo` e `key` estável por parte: os botões são criados UMA vez. Recriar a
 * lista a cada tecla mata o clique junto com o nó — bug medido no protótipo da
 * fase 2 do editor de mesa (T2.5, spec 096). A cicatriz viaja com o padrão.
 */

type ProfileEditorSidebarProps = Readonly<{
  activePartId: ProfilePartId;
  pendingCounts: Record<ProfilePartId, number>;
  progress: number;
  onSelect: (partId: ProfilePartId) => void;
  /** Endereço público real, já montado. `null` enquanto não há slug. */
  publicUrl: string | null;
  /**
   * Grava o pendente e devolve se pode abrir. Ver `flushGm` em
   * `profileContextCore.ts`.
   */
  onBeforeOpen: () => Promise<boolean>;
}>;

export const ProfileEditorSidebar = memo(function ProfileEditorSidebar({
  activePartId,
  pendingCounts,
  progress,
  onSelect,
  publicUrl,
  onBeforeOpen,
}: ProfileEditorSidebarProps) {
  return (
    <>
      <div>
        <div className="mb-2 text-xs opacity-70">
          {Math.round(progress * 100)}% preenchido
        </div>
        {/* Barra decorativa: o valor já é anunciado pelo texto acima, então
            `role="progressbar"` aqui duplicaria o anúncio no leitor de tela. */}
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[var(--fill)]"
          aria-hidden="true"
        >
          <div
            className="h-full bg-[var(--color-artificio-orange)] transition-[width]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      {/* `profile-editor-parts-nav`: gancho estável para a media query da casca
          (ProfileEditPage.css) virar esta lista em faixa horizontal abaixo de
          720px. Sem a classe, a regra dependeria do seletor de elemento e
          quebraria em silêncio ao mudar o markup. */}
      <nav className="profile-editor-parts-nav" aria-label="Partes do perfil">
        {PROFILE_PARTS.map((part) => {
          const pending = pendingCounts[part.id] ?? 0;
          const active = part.id === activePartId;
          return (
            <Button
              key={part.id}
              type="button"
              variant={active ? 'primary' : 'ghost'}
              size="sm"
              className="!justify-start w-full"
              /* `location`, não `page`: as partes são seções de um documento
                 contínuo alcançadas por âncora, e a página não muda. `page`
                 anunciaria uma navegação que não aconteceu. */
              aria-current={active ? 'location' : undefined}
              aria-controls={profilePartDomId(part.id)}
              onClick={() => onSelect(part.id)}
            >
              <span className="flex-1 text-left">{part.label}</span>
              {pending > 0 ? (
                <span
                  className="min-w-5 rounded-full bg-[var(--state-danger-bg)] px-2 text-center text-[11px] text-[var(--state-danger-fg)]"
                  aria-label={`${pending} campo(s) recomendado(s) por preencher`}
                >
                  {pending}
                </span>
              ) : null}
            </Button>
          );
        })}
      </nav>

      {publicUrl ? <PublicLinkDoor url={publicUrl} onBeforeOpen={onBeforeOpen} /> : null}
    </>
  );
});

/**
 * A porta para o link oficial (spec §13.11, decisão do mantenedor 2026-09-01:
 * "a prévia tem que direcionar como uma nova aba para onde vai ficar o link
 * oficial").
 *
 * Não é espelho: não há miniatura da página aqui. Conferir o próprio perfil
 * numa réplica de 300px é conferir outra coisa — na aba nova o mestre vê a
 * largura, a rolagem e a ordem reais, do jeito que o jogador recebe. E o
 * endereço, que é o que ele divulga, passa a ser parte do que se confere.
 *
 * O caso ruim tratado: a aba nova busca do servidor, e o autosave espera 500ms.
 * Abrir com o debounce contando mostraria a versão anterior. Por isso o clique
 * grava antes (`onBeforeOpen`) e só abre depois.
 */
function PublicLinkDoor({
  url,
  onBeforeOpen,
}: Readonly<{ url: string; onBeforeOpen: () => Promise<boolean> }>) {
  const [opening, setOpening] = useState(false);
  // Dois motivos distintos para não abrir, com consequências opostas para o
  // mestre: 'save' significa que o conteúdo NÃO foi gravado; 'popup' significa
  // que foi gravado e só a janela foi barrada. Uma mensagem só mentiria em um
  // dos casos.
  const [failure, setFailure] = useState<null | 'save' | 'popup'>(null);

  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    setFailure(null);
    // A aba é aberta EM BRANCO agora, ainda dentro do clique, e só navega
    // depois que a gravação confirma. Abrir depois do `await` perde o gesto do
    // usuário e o bloqueador de pop-up do navegador barra a janela — o mestre
    // clicaria em "Abrir", esperaria o salvamento e não veria aba nenhuma.
    //
    // SEM `noopener,noreferrer` aqui, e isso é obrigatório para o fluxo
    // funcionar: com a flag, o `window.open` devolve `null` na maioria dos
    // navegadores (é justamente o que "sem opener" significa), e sem o handle
    // não há como navegar a aba depois — ela ficaria em branco para sempre.
    // A proteção é reposta na linha seguinte, à mão: `opener = null` corta o
    // acesso da aba nova a esta janela, que é o risco real que a flag cobre.
    // O destino é o próprio site (`/mestre/<slug>`), não um domínio de
    // terceiro — para link externo o caminho continua sendo `safeExternalUrl`.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const saved = await onBeforeOpen();
      if (!saved) {
        // Gravação falhou: NÃO navega, e fecha a aba em branco para não deixar
        // janela órfã. Levar o mestre a uma página sem o que ele acabou de
        // escrever é o engano que este fluxo existe para evitar; o indicador de
        // autosave já mostra o erro.
        tab?.close();
        setFailure('save');
        return;
      }
      if (!tab) {
        // Bloqueador impediu a abertura: avisar em vez de falhar em silêncio.
        // O conteúdo JÁ foi salvo, então a mensagem não pode sugerir perda —
        // o endereço continua visível acima para abrir à mão.
        setFailure('popup');
        return;
      }
      tab.location.replace(url);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-3">
      <p className="text-xs opacity-70">Seu endereço público</p>
      {/* O endereço fica VISÍVEL, não só embutido no botão: é o que o mestre
          cola no Discord, no grupo, na bio. `break-all` porque slug longo em
          coluna de 300px estouraria a lateral. */}
      <p className="break-all text-xs opacity-90">{displayUrl(url)}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void handleOpen()}
        disabled={opening}
      >
        {opening ? 'Salvando…' : 'Abrir em nova aba'}
      </Button>
      {failure ? (
        <p className="text-xs text-[var(--state-danger-fg)]" role="alert">
          {failure === 'save'
            ? 'Não deu para salvar agora — a página abriria sem a sua última mudança.'
            : 'Suas mudanças foram salvas, mas o navegador bloqueou a nova aba. Abra o endereço acima à mão.'}
        </p>
      ) : null}
    </div>
  );
}

/** Exibe o endereço sem o `https://`, que só ocupa largura na lateral. */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
