import type { Config } from '@react-router/dev/config';

// SSR universal (spec 102 T4.1/T4.2, decisão do mantenedor 2026-09-11:
// "o catálogo precisa ser sempre fresco").
//
// `ssr` é flag de APLICAÇÃO, não de rota — medido no tipo instalado
// (`@react-router/dev/dist/config.d.ts:154`). Não existe toggle por rota nesta
// versão, então as rotas autenticadas entram no SSR junto com as públicas; o
// código que só existe no browser fica atrás de `clientLoader` ou de guarda de
// ambiente, nunca no caminho do render.
//
// `prerender` NÃO é usado de propósito: serve HTML do build, o que mostraria
// vaga preenchida como aberta até o rebuild seguinte — exatamente o que o
// requisito de frescor proíbe.
export default {
  ssr: true,
  appDirectory: 'src',
} satisfies Config;
