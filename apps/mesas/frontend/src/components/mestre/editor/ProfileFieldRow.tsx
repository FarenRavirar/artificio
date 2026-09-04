import { useState, type ReactNode } from 'react';
import { Button, Modal } from '@artificio/ui';
import type { GmProfile } from '../../../types/profileTypes';
import { useProfileContext } from '../../../contexts/useProfileContext';

/**
 * Resultado de `toPatch`: ou o patch a gravar, ou a recusa da entrada.
 *
 * União discriminada com `erro?: never` no lado do patch — sem isso o
 * compilador não separa os dois casos, porque `Record<string, unknown>` admite
 * a chave `erro` e `'erro' in x` não estreita nada. O patch é
 * `Partial<GmProfile>` porque é o que `updateGm` aceita: tipar como `Record`
 * genérico obrigaria um cast na chamada, que é onde o erro de campo passaria.
 */
export type ProfileFieldPatch =
  | (Partial<GmProfile> & { readonly erro?: never })
  | { readonly erro: string };

interface ProfileFieldRowProps<T> {
  /** Rótulo da linha — o que o mestre lê antes de decidir se abre o modal. */
  readonly label: string;
  /** Valor atual formatado para leitura; `null` quando o campo está vazio. */
  readonly displayValue: string | null;
  /** Valor real, entregue ao editor dentro do modal. */
  readonly value: T;
  /** Editor do campo. Recebe o rascunho LOCAL do modal, não o valor do perfil. */
  readonly children: (draft: T, setDraft: (next: T) => void) => ReactNode;
  /**
   * Patch a persistir quando o mestre clica em Salvar, ou a recusa da entrada.
   *
   * Devolver `{ erro }` mantém o modal aberto e mostra a mensagem. Sem essa
   * via, um campo com validação (anos de experiência recusa decimal e
   * negativo) só podia devolver patch vazio: o modal fechava, nada era gravado
   * e o mestre saía achando que salvou (achado de review, PR #306).
   */
  readonly toPatch: (draft: T) => ProfileFieldPatch;
  /** Ganchos de nível do editor (`data-ob`/`data-field`), preservados da versão inline. */
  readonly obLevel?: string;
  readonly fieldName?: string;
  /** Frase do ganho exibida sob a linha, quando o campo é recomendado. */
  readonly hint?: string;
}

/**
 * Linha de campo + modal de edição (spec 100, D1/D2/T4.1/T4.2).
 *
 * Substitui o campo inline dos quatro campos curtos (slogan, especialidades,
 * idiomas, anos de experiência): a linha mostra o VALOR ATUAL, e a edição
 * acontece num modal com "Salvar" explícito. Linha vazia exibe "Adicionar"
 * (D21) — é o que substitui a barra "43% preenchido" removida em T4.5: o que
 * falta passa a ser visível item a item, no lugar de um número agregado.
 *
 * **O modal NÃO chama `updateGm` enquanto aberto**, e isso não é preferência
 * de estilo. `updateGm` faz optimistic update no ENQUEUE, não no flush
 * (`ProfileContext.tsx`): a chamada pinta `queryClient` na hora, antes dos
 * 500ms do autosave. Se o modal escrevesse a cada tecla, fechar no X deixaria
 * o valor "descartado" já visível na tela e no cache — o descarte de D2 seria
 * mentira. Por isso o rascunho vive em estado local e só o Salvar persiste.
 *
 * O descarte tem três vias, todas caindo no mesmo `onClose` do `Modal` do
 * pacote: botão X, tecla ESC e clique no backdrop.
 */
export function ProfileFieldRow<T>({
  label,
  displayValue,
  value,
  children,
  toPatch,
  obLevel,
  fieldName,
  hint,
}: ProfileFieldRowProps<T>) {
  const { updateGm, flushGm } = useProfileContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T>(value);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O rascunho nasce do valor do perfil NA ABERTURA, não a cada render:
  // sincronizar sempre sobrescreveria o que o mestre está digitando quando o
  // autosave de outro campo devolvesse o perfil do servidor.
  //
  // Feito no handler, não em `useEffect`: efeito com `setState` dispara render
  // em cascata (`react-hooks/set-state-in-effect`) e ainda abriria o modal por
  // um frame com o rascunho antigo. O mesmo padrão que `MestreHero` usa para
  // estado derivado de prop.
  const abrir = () => {
    setDraft(value);
    setErro(null);
    setOpen(true);
  };

  const handleSave = async () => {
    // Duplo clique em Salvar: hoje seria inócuo por acaso (`updateGm` é merge
    // idempotente e `flushGm` com buffer vazio devolve `true`), mas depender de
    // acaso não é contrato — o botão sai de cena enquanto a escrita está em voo.
    if (saving) return;

    const resultado = toPatch(draft);
    if (typeof resultado.erro === 'string') {
      // Entrada recusada: nada vai ao servidor e o modal fica aberto com o
      // motivo. Fechar em silêncio ensinava que salvou (achado de review, #306).
      setErro(resultado.erro);
      return;
    }

    setErro(null);
    setSaving(true);
    try {
      await updateGm(resultado);
      // `flushGm` devolve `false` quando a gravação falhou: o provider devolve
      // o patch ao buffer e acende `saveError` (`ProfileContext.tsx` — "buffer
      // ainda cheio = não gravou: quem chamou não abre"). Fechar assim mesmo
      // jogaria fora o rascunho numa falha de rede, que é exatamente quando o
      // mestre mais precisa dele. O modal fica aberto, o texto continua na tela
      // e o Salvar pode ser tentado de novo (achado de review, PR #306).
      const gravou = await flushGm();
      if (gravou) setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-field-row" data-ob={obLevel} data-field={fieldName}>
      <button
        type="button"
        className="profile-field-row-trigger"
        onClick={abrir}
      >
        <span className="profile-field-row-label">{label}</span>
        {displayValue ? (
          <span className="profile-field-row-value">{displayValue}</span>
        ) : (
          // D21: convite à ação, não "—". O vazio precisa dizer o que fazer.
          <span className="profile-field-row-empty">Adicionar</span>
        )}
      </button>

      {hint && <p className="profile-field-row-hint">{hint}</p>}

      <Modal
        open={open}
        title={label}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              Salvar
            </Button>
          </>
        }
      >
        {children(draft, setDraft)}

        {erro && (
          <p className="profile-field-row-error" role="alert">
            {erro}
          </p>
        )}
      </Modal>
    </div>
  );
}
