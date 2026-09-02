import type { GmProfile } from '../../../types/profileTypes';
import { normalizeSellingPoints } from '../../../hooks/useMestre';

/**
 * Casca do editor de perfil de mestre: as 5 partes e o cálculo de pendências
 * (spec 099, fase G — G3/G4).
 *
 * Por que existe, e por que aqui: a fase B entregou os campos do perfil sem a
 * casca que `old_spec.md:495-503` mandava aplicar, e o mantenedor recusou o
 * resultado em beta ("está centralizado, sem etapas como nas laterais, que tem
 * no atual editor de mesas"). Este módulo é o equivalente de `editorParts.ts` +
 * a parte de contagem de `editorValidation.ts` para o perfil.
 *
 * **É duplicação deliberada, registrada e datada (2026-09-01).** A G1 manda
 * copiar o padrão do editor de mesa sem extrair nada, e a G6 — última task da
 * fase — compara as duas cascas existindo lado a lado e extrai só o que elas
 * comprovadamente compartilham. O motivo está no plano: abstrair a partir de
 * dois casos, sendo que o segundo ainda não existia, é o fracasso público do
 * DLS do Airbnb (o sistema ficou rígido cedo demais e cada variante nova virou
 * estilo empilhado no componente). Extrair primeiro trocaria dívida datada por
 * risco de regressão em código que está no ar.
 *
 * Vive fora do arquivo de componentes por causa do
 * `react-refresh/only-export-components` — mesmo motivo de
 * `profileEditorDomain.ts` e de `editorParts.ts` no editor de mesa.
 */

export type ProfilePartId = 'quem' | 'como' | 'mesa' | 'prova' | 'onde';

export interface ProfilePartMeta {
  id: ProfilePartId;
  label: string;
  /**
   * A pergunta do jogador que a parte responde (spec §2.13). O agrupamento é
   * por pergunta, que é o critério que governa a spec inteira (§0) — não por
   * tipo de campo, que produziria "textos", "imagens", "listas".
   */
  question: string;
}

/**
 * As 5 partes na ordem de spec §13.5, com vocabulário conversacional — o
 * padrão que `editorParts.ts` já estabeleceu ("Quando joga", "Para quem é"),
 * nunca rótulo genérico de CRUD.
 *
 * Cinco, e não sete como no anúncio: o perfil tem menos matéria que a mesa.
 *
 * Fonte única da ordem da lateral: a nav itera sobre esta lista constante, com
 * `key` estável por parte. Recriar a lista de botões a cada tecla mata o
 * clique junto com o nó — bug medido no protótipo da fase 2 do editor de mesa
 * (T2.5, spec 096), e a cicatriz viaja para cá junto com o padrão.
 */
export const PROFILE_PARTS: readonly ProfilePartMeta[] = [
  { id: 'quem', label: 'Quem é você', question: 'quem vai conduzir minha mesa?' },
  { id: 'como', label: 'Como você mestra', question: 'o estilo dele combina comigo?' },
  { id: 'mesa', label: 'Sua mesa', question: 'eu caberia nessa mesa?' },
  { id: 'prova', label: 'Prova', question: 'por que eu confiaria?' },
  { id: 'onde', label: 'Onde te achar', question: 'consigo ver ele mestrando?' },
];

export function getProfilePartLabel(partId: ProfilePartId): string {
  return PROFILE_PARTS.find((part) => part.id === partId)?.label ?? partId;
}

/** `id` do elemento de seção — gancho do `scrollIntoView` e do `aria-controls`. */
export function profilePartDomId(partId: ProfilePartId): string {
  return `profile-part-${partId}`;
}

/**
 * Onde cada campo RECOMENDADO mora, por parte (A12).
 *
 * As chaves são exatamente as de `RECOMMENDED_GAIN` (`profileEditorDomain.ts`),
 * que o teste cruzado de B6 já amarra ao `data-field` renderizado. Manter os
 * dois registros alinhados é condição de aceite: campo recomendado sem parte
 * não teria como aparecer na contagem da lateral, e o teste desta fase falha
 * se as duas listas divergirem.
 *
 * `links` fica em "Onde te achar" e não em "Prova": a pergunta que ele responde
 * é "consigo ver ele mestrando?" (§13.5), não "por que eu confiaria?".
 */
export const PROFILE_PART_RECOMMENDED_FIELDS: Readonly<
  Record<ProfilePartId, readonly string[]>
> = {
  quem: ['tagline', 'experienceYears'],
  // `languages` conta AQUI porque é aqui que ele aparece: o campo mora dentro
  // de `ProfileTagsSection`, renderizada nesta parte. Contá-lo em "Sua mesa"
  // (onde ele responde melhor à pergunta do jogador) punha o badge numa seção
  // que não tem o controle — o mestre clicava na pendência e caía num lugar
  // onde não dá para resolvê-la. Achado do Codex, PR #304.
  // Mover o campo para "Sua mesa" exigiria quebrar `ProfileTagsSection` em
  // dois, o que é reescrever componente — e a G3 redistribui, não reescreve.
  como: ['bioLong', 'specialties', 'sellingPoints', 'languages'],
  // "Sua mesa" reúne sistemas e grupo fechado, que são opcionais por §8: sem
  // campo recomendado, a contagem é legitimamente 0.
  mesa: [],
  // "Prova" reúne avaliações e selos, que hoje não têm campo recomendado no
  // editor: os selos (`badges`) são opcionais por §8 e as avaliações não são
  // editáveis aqui (D3 mantém o sistema de avaliações fora da spec). A parte
  // existe na navegação porque responde a uma pergunta do jogador; sua
  // contagem de pendências é legitimamente 0.
  prova: [],
  onde: ['links'],
};

/**
 * Um campo recomendado está preenchido? (equivalente de `isFieldFilled`,
 * `editorValidation.ts:131`.)
 *
 * O perfil é editado por autosave, campo a campo — não há "publicar" que
 * dispare validação. Então a contagem é sempre viva: ela reflete o estado do
 * `profile.gm` que o contexto já mantém, e cai ao preencher, na mesma sessão,
 * sem recarregar (A12).
 *
 * `links` não vem do `gm`: é coleção própria (`useLinks`), então entra por
 * parâmetro em vez de ser lida daqui.
 */
export function isProfileFieldFilled(
  fieldId: string,
  gm: Partial<GmProfile> | null | undefined,
  linkCount: number,
): boolean {
  if (fieldId === 'links') return linkCount > 0;

  const profile = gm ?? {};

  switch (fieldId) {
    case 'tagline':
      return hasText(profile.tagline);
    case 'bioLong':
      return hasText(profile.bio_long);
    case 'experienceYears':
      // 0 é resposta válida ("mestro há menos de um ano"), então o teste é de
      // presença numérica, não de verdade — `!profile.experience_years`
      // contaria 0 como vazio.
      return typeof profile.experience_years === 'number';
    case 'specialties':
      return hasItems(profile.specialties);
    case 'languages':
      return hasItems(profile.languages);
    case 'sellingPoints':
      // Normaliza antes de contar: `hasItems` só olha o comprimento, e o JSONB
      // pode trazer `[{}]` ou `['x']` — array não-vazio de item inválido. O
      // `SellingPointsEditor` passa o mesmo valor por `normalizeSellingPoints` e
      // mostra ZERO itens, então a lateral marcava a parte como preenchida (até
      // 100%) enquanto o campo estava vazio na tela. Achado do Codex na PR #304.
      return normalizeSellingPoints(profile.selling_points).length > 0;
    default:
      return false;
  }
}

/**
 * Pendências por parte (equivalente de `pendingCounts` do editor de mesa).
 *
 * Todo dado que entra aqui vem do backend e é `unknown` até prova em contrário
 * (AGENTS.md §Normalização): `hasItems` checa `Array.isArray` antes de olhar
 * `length`, e nenhum caminho aqui faz `.map`/`.filter` sobre payload externo.
 */
export function computeProfilePendingCounts(
  gm: Partial<GmProfile> | null | undefined,
  linkCount: number,
): Record<ProfilePartId, number> {
  const counts = {} as Record<ProfilePartId, number>;
  for (const part of PROFILE_PARTS) {
    const fields = PROFILE_PART_RECOMMENDED_FIELDS[part.id];
    let pending = 0;
    for (const fieldId of fields) {
      if (!isProfileFieldFilled(fieldId, gm, linkCount)) pending += 1;
    }
    counts[part.id] = pending;
  }
  return counts;
}

/**
 * Fração preenchida dos recomendados, para a barra da lateral — mesma leitura
 * do "N% preenchido" do editor de mesa. Sem recomendado algum, devolve 1 (nada
 * a pedir é 100%, não 0%).
 */
export function computeProfileProgress(
  gm: Partial<GmProfile> | null | undefined,
  linkCount: number,
): number {
  let total = 0;
  let filled = 0;
  for (const part of PROFILE_PARTS) {
    for (const fieldId of PROFILE_PART_RECOMMENDED_FIELDS[part.id]) {
      total += 1;
      if (isProfileFieldFilled(fieldId, gm, linkCount)) filled += 1;
    }
  }
  return total === 0 ? 1 : filled / total;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}
