import React from 'react';
import type { ReactNode } from 'react';
import { ProfileContext, type ProfileContextValue } from './profileContextCore';
import type { FullProfile, GmProfile } from '../types/profileTypes';
import { queryClient } from '../lib/queryClient';
import {
  useProfileQuery,
  useUpdateUser,
  useUpdateProfile,
  useUpdatePlayer,
  useUpdateGm,
  marcarGmExistente,
  useAddSystem,
  useRemoveSystem,
} from '../hooks/useProfileQuery';

/**
 * Context para centralizar estado do perfil usando React Query
 * Elimina requisições duplicadas e fornece cache automático + optimistic updates
 */

interface ProfileProviderProps {
  children: ReactNode;
}

const AUTOSAVE_DEBOUNCE_MS = 500;

const toErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'Erro ao salvar alterações.';

export function ProfileProvider({ children }: ProfileProviderProps) {
  // Query principal
  const { data: profile, isLoading, error, refetch } = useProfileQuery();

  // Mutations
  const updateUserMutation = useUpdateUser();
  const updateProfileMutation = useUpdateProfile();
  const updatePlayerMutation = useUpdatePlayer();
  const updateGmMutation = useUpdateGm();
  const addSystemMutation = useAddSystem();
  const removeSystemMutation = useRemoveSystem();

  // Estado de saving (qualquer mutation em andamento)
  const saving =
    updateUserMutation.isPending ||
    updateProfileMutation.isPending ||
    updatePlayerMutation.isPending ||
    updateGmMutation.isPending ||
    addSystemMutation.isPending ||
    removeSystemMutation.isPending;

  // Erro da última gravação — alimenta o indicador de autosave da página.
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Autosave do perfil de mestre (spec 099 B8): debounce real com buffer.
  //
  // Antes, cada digitação chamava `updateGm` → `mutateAsync` na hora (uma
  // requisição por tecla) e o guard `if (isPending) return;` DESCARTava em
  // silêncio qualquer mudança feita durante um request em voo.
  //
  // Agora `updateGm` só acumula o patch por campo num buffer (refs, sem
  // re-render por tecla) e agenda o flush para 500ms após a última mudança.
  // Um "pump" (loop) esvazia o buffer: se houver mutation em voo, espera ela
  // terminar e então dispara a próxima — mudança durante voo NUNCA é
  // descartada, vira mutation nova ao terminar. Em erro, o patch volta ao
  // buffer (a próxima digitação o reenvia) e o erro aparece no indicador;
  // sem retry automático, para não loopar em rejeição determinística.
  //
  // `saving` continua derivado de `isPending`, então o indicador acende
  // durante o flush real; os refs não disparam re-render no intervalo de
  // debounce (deliberado: a UI não pisca por tecla).
  // ---------------------------------------------------------------------------

  // Patch pendente (acumulado por campo, último valor vence).
  const gmBufferRef = React.useRef<Partial<GmProfile> | null>(null);
  // Timer do debounce.
  const gmTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Promise da mutation gm em voo — o pump a aguarda antes do próximo flush.
  // Própria (não `isPending` de snapshot de render): o closure do timer pode
  // capturar um objeto de mutation de render anterior com `isPending` obsoleto.
  const gmInFlightRef = React.useRef<Promise<unknown> | null>(null);
  // Guarda de pump único: flush concorrente não pode nascer enquanto um roda.
  const gmPumpRef = React.useRef<Promise<void> | null>(null);

  React.useEffect(() => {
    return () => {
      // Desmonte do provider: cancela o debounce pendente (o flush não tem
      // para onde ir sem o provider montado).
      if (gmTimerRef.current) clearTimeout(gmTimerRef.current);
    };
  }, []);

  // Memoizar o valor do contexto
  const value = React.useMemo<ProfileContextValue>(() => {
    const runGmPump = async (): Promise<void> => {
      while (true) {
        if (gmInFlightRef.current) {
          // Mutation em voo: espera terminar antes de pegar o buffer.
          // Rejeição aqui nunca acontece — o lançador captura e encerra o pump.
          await gmInFlightRef.current;
          gmInFlightRef.current = null;
          continue;
        }
        const patch = gmBufferRef.current;
        if (!patch) return;
        gmBufferRef.current = null;
        gmInFlightRef.current = updateGmMutation.mutateAsync(patch);
        try {
          await gmInFlightRef.current;
          setSaveError(null);
        } catch (error) {
          // Devolve o patch ao buffer: a próxima digitação reenvia o valor
          // que falhou. Sem re-agendar o flush — retry automático looparia
          // numa rejeição determinística (ex.: validação do PUT).
          // `?? {}`: o buffer e zerado antes do voo, entao o TS sabe que
          // `current` e `null` aqui (TS2698) — mas durante o `await` acima uma
          // digitacao nova pode te-lo repovoado. O patch que falhou entra
          // PRIMEIRO por ser o mais antigo: o que chegou depois sobrescreve, que
          // a mesma precedencia do merge feito no enqueue de `updateGm`.
          const chegouDuranteOVoo = gmBufferRef.current;
          gmBufferRef.current = { ...patch, ...(chegouDuranteOVoo ?? {}) };
          setSaveError(toErrorMessage(error));

          // Sem edicao nova: encerra. Reenviar o mesmo patch que acabou de ser
          // recusado looparia numa rejeicao deterministica (ex.: validacao do
          // PUT), e o usuario ja ve o erro no indicador.
          //
          // COM edicao nova: agenda UM flush. Enquanto este pump rodava,
          // `flushGmBuffer` retornava cedo (`gmPumpRef` ativo) confiando que o
          // loop veria o buffer — mas o `return` daqui encerra o pump antes
          // disso, e o valor mais recente ficava parado ate a proxima
          // digitacao. Um unico flush agendado, nao re-entrada no loop: mantem
          // a trava anti-loop e nao perde a edicao (achado de review, PR #297).
          if (chegouDuranteOVoo) {
            if (gmTimerRef.current) clearTimeout(gmTimerRef.current);
            gmTimerRef.current = setTimeout(() => {
              gmTimerRef.current = null;
              flushGmBuffer();
            }, AUTOSAVE_DEBOUNCE_MS);
          }
          return;
        } finally {
          gmInFlightRef.current = null;
        }
        // Loop continua: se algo chegou ao buffer durante o voo, dispara
        // mutation nova ao terminar (nada descartado).
      }
    };

    const flushGmBuffer = (): void => {
      if (gmPumpRef.current) return; // pump já rodando — ele enxerga o buffer
      const pump = runGmPump();
      gmPumpRef.current = pump;
      void pump.finally(() => {
        gmPumpRef.current = null;
      });
    };

    return {
      profile,
      loading: isLoading,
      error: error ? String(error) : null,
      saving,
      saveError,
      refetch,
      updateUser: async (data) => {
        if (updateUserMutation.isPending) return;
        try {
          await updateUserMutation.mutateAsync(data);
          setSaveError(null);
        } catch (mutationError) {
          setSaveError(toErrorMessage(mutationError));
        }
      },
      updateProfile: async (data) => {
        if (updateProfileMutation.isPending) return;
        try {
          await updateProfileMutation.mutateAsync(data);
          setSaveError(null);
        } catch (mutationError) {
          setSaveError(toErrorMessage(mutationError));
        }
      },
      updatePlayer: async (data) => {
        if (updatePlayerMutation.isPending) return;
        try {
          await updatePlayerMutation.mutateAsync(data);
          setSaveError(null);
        } catch (mutationError) {
          setSaveError(toErrorMessage(mutationError));
        }
      },
      updateGm: async (data) => {
        // Debounce com buffer: acumula o patch e re-agenda o flush a cada
        // chamada — 500ms de pausa = uma mutation com o patch mesclado.
        gmBufferRef.current = { ...gmBufferRef.current, ...data };

        // Optimistic update NO ENQUEUE, não só no `onMutate` da mutation.
        // Sem isto, durante os 500ms de debounce o cache fica no valor antigo e
        // os campos compostos (TagInput de specialties/languages/badges) leem a
        // prop desatualizada: duas tags digitadas rápido calculam `[...value, x]`
        // do MESMO array, e como o buffer é "último valor vence" por campo, a
        // segunda apaga a primeira em silêncio (achado de review, PR #297).
        const anterior = queryClient.getQueryData<FullProfile>(['profile', 'me']);
        // ANTES de escrever: este e o ponto mais cedo em que o estado real do
        // `gm` ainda e visivel. A escrita logo abaixo preenche `gm` mesmo quando
        // era null, e o `onMutate` (500ms depois) ja nao consegue distinguir
        // mestre novo de existente — o que mandaria todo mundo ao PUT (404).
        marcarGmExistente(Boolean(anterior?.gm));
        if (anterior) {
          queryClient.setQueryData<FullProfile>(['profile', 'me'], {
            ...anterior,
            gm: anterior.gm
              ? { ...anterior.gm, ...data }
              : (data as FullProfile['gm']),
          });
        }
        if (gmTimerRef.current) clearTimeout(gmTimerRef.current);
        gmTimerRef.current = setTimeout(() => {
          gmTimerRef.current = null;
          flushGmBuffer();
        }, AUTOSAVE_DEBOUNCE_MS);
      },
      // Sem `if (isPending) return`: o guard descartava o clique EM SILENCIO
      // enquanto uma chamada estava em voo, e a tela nao dava sinal nenhum —
      // o mestre clicava de novo, e de novo. Medido em producao (2026-09-01,
      // logs do `mesas-api`): 6 `DELETE .../profile/systems/6552a50a`, o MESMO
      // id, em pares de ~1s. E a mesma falha que a spec 099 B8 tirou do
      // `updateGm`; aqui ela tinha ficado de pe.
      //
      // A mutation ja e idempotente do lado do servidor (`addUserSystem` faz
      // `onConflict(...).doNothing()`), entao deixar o clique passar custa uma
      // requisicao a mais e devolve o que o usuario pediu — ao contrario de
      // engolir a acao, que ensina que o botao nao funciona.
      // Descarrega o autosave pendente e espera a gravação (spec 099 G4).
      // Reusa o pump existente em vez de gravar por fora: chamar a mutation
      // direto daqui criaria um segundo caminho de escrita concorrente com o
      // debounce, que é justamente o defeito que a B8 consertou.
      flushGm: async (): Promise<boolean> => {
        // Cancela a espera do debounce: o que estiver no buffer vai agora.
        if (gmTimerRef.current) {
          clearTimeout(gmTimerRef.current);
          gmTimerRef.current = null;
        }
        flushGmBuffer();
        // O pump só existe se havia o que gravar; sem ele, nada pendente.
        await gmPumpRef.current;
        // O pump devolve o patch ao buffer quando a gravação falha (e acende
        // `saveError`). Buffer ainda cheio = não gravou: quem chamou não abre.
        return gmBufferRef.current === null;
      },
      addSystem: async (systemId, type = 'favorite') => {
        try {
          await addSystemMutation.mutateAsync({ systemId, type });
          setSaveError(null);
        } catch (mutationError) {
          setSaveError(toErrorMessage(mutationError));
        }
      },
      // Mesmo motivo do `addSystem` acima — os 6 DELETEs medidos eram daqui.
      removeSystem: async (systemId) => {
        try {
          await removeSystemMutation.mutateAsync(systemId);
          setSaveError(null);
        } catch (mutationError) {
          setSaveError(toErrorMessage(mutationError));
        }
      },
    };
  }, [
    profile,
    isLoading,
    error,
    saving,
    saveError,
    refetch,
    updateUserMutation,
    updateProfileMutation,
    updatePlayerMutation,
    updateGmMutation,
    addSystemMutation,
    removeSystemMutation,
  ]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
