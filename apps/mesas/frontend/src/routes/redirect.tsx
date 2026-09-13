import { redirect } from 'react-router';
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
 */
export function redirectTo(to: string) {
  return function loader({ params }: LoaderFunctionArgs) {
    const sub = params.sub ? `/${params.sub}` : '';
    return redirect(`${to}${sub}`);
  };
}

export default function Redirect() {
  return null;
}
