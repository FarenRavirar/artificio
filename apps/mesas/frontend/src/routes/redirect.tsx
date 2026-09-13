import { replace } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

/**
 * Fábrica de redirect de rota legada (spec 102 T4.2).
 *
 * Existe para não haver um arquivo de 8 linhas por redirect — eram 6 módulos de
 * corpo idêntico variando só a string de destino. Cada rota legada vira um
 * módulo de UMA linha que chama esta função (o framework exige um arquivo por
 * rota; o que ele não exige é que a lógica esteja duplicada em cada um).
 *
 * `:sub?`, quando existe, é preservado: deep link antigo de
 * `/gestao/moderacao/rascunhos` precisa chegar na aba certa.
 *
 * `replace` e NÃO `redirect`: o alias SUBSTITUI a entrada no histórico em vez de
 * empilhar outra. Com `redirect`, clicar em buscar (`AppShell.tsx:41`,
 * `navigate('/busca')`) levava a `/catalogo`, e o Voltar caía em `/busca`, que
 * redirecionava de novo — o visitante não conseguia voltar à página anterior.
 * As 6 rotas legadas usavam `<Navigate replace />` antes da migração para
 * framework mode (`App.tsx` em `49ac4b1`); trocar por `redirect` perdeu o
 * `replace` junto. Achado do Codex (P2) na PR #319.
 */
export function redirectTo(to: string) {
  return function loader({ params }: LoaderFunctionArgs) {
    const sub = params.sub ? `/${params.sub}` : '';
    return replace(`${to}${sub}`);
  };
}

export default function Redirect() {
  return null;
}
