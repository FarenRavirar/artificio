-- Changelog para refatoração UX do catálogo
-- Data: 2026-04-08 03:26:00 BRT
-- Deploy: Beta

INSERT INTO update_log (title, body, type, published, created_at) 
VALUES (
  'Catálogo mais organizado e fácil de usar',
  'Melhoramos a forma como você busca e filtra mesas no catálogo:

• **Filtros mais organizados** - Agora fica mais fácil encontrar o que você procura, com tudo separadinho em blocos
• **Filtros no celular** - No celular, você clica no botão "Filtros" e abre um menu lateral bonitinho
• **Você vê o que filtrou** - Os filtros que você escolheu aparecem como etiquetas coloridas que você pode remover clicando nelas
• **Botões mais claros** - Agora você sabe na hora se pode entrar na mesa ou se precisa ver os detalhes primeiro
• **Mais mesas na tela** - Reorganizamos tudo para você ver mais mesas de uma vez

Explore o catálogo e encontre sua próxima aventura! 🎲

_Atualização publicada em 08/04/2026 às 03:26_',
  'app',
  true,
  '2026-04-08 03:26:00'::timestamp
);
