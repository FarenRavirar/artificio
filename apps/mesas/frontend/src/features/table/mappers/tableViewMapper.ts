// Derivação de mesa — fonte única em `@artificio/catalog-table` (spec 102 T4.2).
//
// Moveu para o pacote por causa da regra pétrea de T4.3: nenhum fato pode existir
// só no JSON-LD. Preço, vagas e urgência do markup têm de sair da MESMA função
// que produz o HTML visível — se o servidor derivasse por um caminho e o cliente
// por outro, os dois divergiriam sem quebrar nada, e o markup viraria alvo de
// ação manual de structured data.
export { mapTableToView, normalizeNumeric } from '@artificio/catalog-table';
