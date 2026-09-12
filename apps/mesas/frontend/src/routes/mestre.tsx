import { data } from 'react-router';
import type { LoaderFunctionArgs, MetaArgs } from 'react-router';
import { MestrePage } from '../pages/MestrePage';
import { apiUrl } from '../lib/apiUrl';
import { normalizeMestreProfile, type MestrePublicData } from '../hooks/useMestre';
import { MODULE_ORIGINS } from '@artificio/config';

const SITE_NAME = 'Artifício Mesas';
const SITE_URL = MODULE_ORIGINS.mesas;

export type MestreLoaderData = { profile: MestrePublicData };

/**
 * Busca o perfil público do mestre NO SERVIDOR (spec 102 T4.2).
 *
 * Sem credencial de propósito: o `useMestre` usava `authGet`, que envia a
 * sessão do visitante. No servidor não existe visitante no momento do render, e
 * mandar cookie do request para a API abriria a porta para o HTML de um usuário
 * ser servido a outro por cache. O que o SSR precisa é só a parte pública do
 * perfil; `viewer_context` continua resolvido no cliente.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw data({ message: 'Mestre não encontrado.' }, { status: 404 });
  }

  const res = await fetch(apiUrl(`/api/v1/gm/perfis/${encodeURIComponent(slug)}`), {
    signal: request.signal,
    headers: { accept: 'application/json' },
  });

  if (res.status === 404) {
    throw data({ message: 'Mestre não encontrado.' }, { status: 404 });
  }

  if (!res.ok) {
    throw data(
      { message: 'Não foi possível carregar o perfil do mestre.' },
      { status: res.status === 503 ? 503 : 500 },
    );
  }

  const json = (await res.json()) as { data?: MestrePublicData | null };
  const profile = normalizeMestreProfile(json.data);

  if (!profile) {
    throw data({ message: 'Mestre não encontrado.' }, { status: 404 });
  }

  return data<MestreLoaderData>({ profile });
}

/**
 * O perfil de mestre entra em HTML-first, mas **não recebe schema** nesta spec
 * (escopo declarado em T4.2): `Person`/`ProfilePage` fica fora, para não virar
 * improviso. O que resolve os achados B/C/E aqui é o conteúdo visível.
 */
export function meta({ data: loaderData }: MetaArgs<typeof loader>) {
  const profile = (loaderData as MestreLoaderData | undefined)?.profile;

  if (!profile) {
    return [
      { title: `Mestre não encontrado — ${SITE_NAME}` },
      { name: 'robots', content: 'noindex' },
    ];
  }

  const title = `${profile.display_name} | Mestre | ${SITE_NAME}`;
  // Seleção não-branca: a cadeia trata só-whitespace como ausência, mesma regra
  // que a página aplicava em `applySeo`.
  const description =
    [profile.tagline, profile.bio_long?.slice(0, 150)].find(
      (candidate) => candidate != null && candidate.trim() !== '',
    ) ?? 'Landing pública de mestre com mesas ativas e especialidades.';
  const url = `${SITE_URL}/mestre/${profile.slug}`;
  const image = profile.avatar_url ?? profile.banner_url ?? `${SITE_URL}/og-default.png`;

  return [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: url },

    { property: 'og:type', content: 'profile' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:url', content: url },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'profile:username', content: profile.slug },

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ];
}

export default MestrePage;
