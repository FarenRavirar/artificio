// T6.2 (spec 072) — guard de avaliacao: so conta com download previo do
// mesmo material pode avaliar (D111 item 5). A checagem real de "baixou ou
// nao" depende da métrica por-usuário da spec 074 (esta rodada só tem
// agregado diário em download_metric_daily, sem granularidade por usuário) —
// aqui fica só a regra de bloqueio, parametrizada por um checker injetável
// para não acoplar esta spec a uma tabela que ainda não existe.

export type HasDownloadedChecker = (userId: string, materialId: string) => Promise<boolean>;

export class RatingNotAllowedError extends Error {
  constructor(readonly userId: string, readonly materialId: string) {
    super('Avaliação permitida apenas para quem já baixou este material.');
    this.name = 'RatingNotAllowedError';
  }
}

export async function assertCanRate(
  userId: string,
  materialId: string,
  hasDownloaded: HasDownloadedChecker,
): Promise<void> {
  const downloaded = await hasDownloaded(userId, materialId);
  if (!downloaded) {
    throw new RatingNotAllowedError(userId, materialId);
  }
}
