// FIXTURE SINTÉTICA — não é captura de produção.
//
// Spec 093, T1.0 / spec.md §Gap 4. O anúncio Kingmaker original
// (message_id 1539593774265671751) não existe no repositório e não será
// recuperado (decisão do mantenedor, 2026-08-19). Este texto é uma reconstrução
// mínima que reproduz as duas condições medidas do defeito:
//
//  1. A linha de prosa ("…jogo já dia 25/08, os jogadores…") passa o filtro de
//     linha e entrega o par [25, 08], que o parser lia como slots_total:25.
//  2. A linha da vaga real ("1 disponível de 4 jogadores") não casa em
//     estratégia alguma da cascata (RE_SLOT_X_DE_Y exige número colado ao "de").
//
// Por ser sintética, ela prova o mecanismo, não a incidência — não usar como
// evidência de quantas mesas em produção têm o mesmo defeito.
export const gap4KingmakerAnnouncement = [
  '**Mesa:** Kingmaker — Pathfinder 2e',
  '**Vagas:** 1 disponível de 4 jogadores',
  '**Dia:** terça · **Horário:** 20:00',
  '',
  'Por conta da saída recente de um jogador, essa chamada é para ter jogo já',
  'dia 25/08, os jogadores apenas tiveram a Sessão 0 e Sessão 1.',
].join('\n');
