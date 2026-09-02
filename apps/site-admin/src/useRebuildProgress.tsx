import { useCallback, useEffect, useRef, useState } from "react";
import { api, type JobPhase, type JobState } from "./api";

/**
 * Acompanhamento do rebuild depois de publicar — compartilhado por PostEditor e PageEditor.
 *
 * Existe porque publicar dizia só "rebuild disparado" e silenciava por minutos: sem sinal
 * de progresso nem de fim, o mantenedor não tinha como distinguir "ainda buildando" de
 * "quebrou" — e na primeira publicação real (2026-09-02) esperou o suficiente para
 * concluir que nada tinha acontecido.
 *
 * Vive aqui, e não copiado nos dois editores, porque publicar um post e publicar uma
 * página disparam o MESMO job: duas cópias divergiriam na primeira vez que só uma fosse
 * corrigida, e o autor veria mensagens diferentes para o mesmo desfecho. Sonar mediu 37
 * linhas duplicadas (68,5%) entre os dois arquivos antes desta extração.
 */

// Rótulo por fase. O indicador fica FORA do toast de propósito: o toast some em 3,5s e o
// build leva minutos — era exatamente essa lacuna que fazia a publicação parecer travada.
const FASE_LABEL: Record<JobPhase, string> = {
  iniciando: "Iniciando rebuild...",
  exportando: "Exportando conteúdo...",
  build: "Gerando páginas...",
  busca: "Indexando busca...",
  publicando: "Publicando arquivos...",
  purgando: "Limpando cache do site...",
  concluido: "Concluído.",
};

/** Mensagem final: distingue "no ar agora" de "no ar em até 2h" (purga não aconteceu). */
export function resumoFinal(job: JobState): { msg: string; err: boolean } {
  if (!job.ok) return { msg: "O rebuild falhou. O site continua na versão anterior.", err: true };

  const p = job.purge;
  // "no ar" exige purga BEM-SUCEDIDA, não apenas rebuild bom. Três desfechos:
  //
  //   ok:true         -> a borda esqueceu o HTML antigo; está no ar agora.
  //   ok:false        -> tentou e falhou (rede, token inválido).
  //   attempted:false -> nem tentou: falta CLOUDFLARE_PURGE_TOKEN/ZONE_ID ou
  //                      PUBLIC_SITE_URL. Os compose files aceitam credencial vazia,
  //                      então isto é um estado REAL de produção, não hipótese.
  //
  // Tratar `attempted:false` como sucesso era o pior dos três: reproduz o incidente que
  // este trabalho corrigiu (borda servindo HTML de 5 dias) e ainda anuncia "no ar".
  // Achado do Codex (P1).
  if (p?.ok === true) return { msg: "Publicado e no ar.", err: false };
  if (p?.attempted) {
    return { msg: "Publicado, mas a limpeza do cache falhou — pode levar até 2h para aparecer.", err: true };
  }
  return {
    msg: "Publicado. A limpeza do cache não está configurada — pode levar até 2h para aparecer.",
    err: true,
  };
}

export interface RebuildProgress {
  /** Fase atual, ou `null` quando não há rebuild sendo acompanhado. */
  fase: JobPhase | null;
  /** Rótulo pronto para render, ou `null`. */
  rotulo: string | null;
  /**
   * Começa a acompanhar. `startedAt` é o carimbo DO SERVIDOR (vem no `SaveResult`) e
   * identifica o job; passe `undefined` quando o rebuild já estava em curso (`busy`),
   * porque nesse caso o job começou antes e o filtro o descartaria para sempre.
   */
  acompanhar: (startedAt?: string) => void;
}

/** `note` é o toast do editor; o hook não impõe um, para não duplicar o que já existe lá. */
export function useRebuildProgress(note: (msg: string, isErr?: boolean) => void): RebuildProgress {
  const [fase, setFase] = useState<JobPhase | null>(null);

  // `note` é recriado a cada render nos dois editores (arrow inline). Guardá-lo numa ref
  // mantém `acompanhar` com identidade estável de verdade — sem isto o `useCallback`
  // abaixo se refaria a cada render e seria decoração enganosa, além de impedir que
  // `acompanhar` seja usado com segurança como dependência de efeito no futuro.
  const noteRef = useRef(note);
  useEffect(() => { noteRef.current = note; });

  const acompanhar = useCallback(
    (startedAt?: string) => {
      setFase("iniciando");
      void api
        .trackRebuild((job) => setFase(job.phase ?? null), { startedAfter: startedAt })
        .then((job) => {
          // `null` = timeout do acompanhamento, NÃO falha do rebuild: o build segue no
          // servidor. Dizer "falhou" aqui mandaria o autor republicar sem necessidade.
          if (!job) {
            setFase(null);
            noteRef.current("Parei de acompanhar o rebuild (demorou demais).", true);
            return;
          }
          const { msg, err } = resumoFinal(job);
          setFase(null);
          noteRef.current(msg, err);
        })
        .catch(() => setFase(null));
    },
    [],
  );

  return { fase, rotulo: fase ? FASE_LABEL[fase] : null, acompanhar };
}

/** Indicador visual da fase. Renderiza nada quando não há rebuild em curso. */
export function RebuildIndicator({ rotulo }: Readonly<{ rotulo: string | null }>) {
  if (!rotulo) return null;
  return (
    <span className="rebuild-progress" role="status" aria-live="polite">
      <span className="rebuild-spinner" aria-hidden="true" />
      {rotulo}
    </span>
  );
}
