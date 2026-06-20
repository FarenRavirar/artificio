// Catálogo de grupos/canais de WhatsApp do Artifício RPG.
// Fonte: https://artificiorpg.com/grupos-de-whatsapp-de-rpg-de-mesa/ (extraído 2026-06-20).
// A logo de cada grupo é o og:image do link de convite, baixada no build por
// `pnpm --filter @artificio/links logos` → src/assets/groups/<id>.jpg (commitada).
// Convites do WhatsApp podem expirar — revalidar visualmente e re-rodar `logos` quando atualizar.

export type GroupKind = "group" | "channel";

export interface WhatsappGroup {
  /** id estável (sufixo do convite) — também o nome do arquivo da logo */
  id: string;
  /** nome do grupo/canal (og:title) */
  name: string;
  /** rótulo temático/contexto exibido como tag */
  tag?: string;
  /** descrição curta */
  description: string;
  /** link de convite (chat.whatsapp.com / whatsapp.com/channel) */
  href: string;
  kind: GroupKind;
}

export interface GroupCategory {
  id: string;
  title: string;
  groups: WhatsappGroup[];
}

export const GROUP_CATEGORIES: GroupCategory[] = [
  {
    id: "artificio",
    title: "Do Artifício RPG",
    groups: [
      {
        id: "BXY5PS8M1YeJkUFas6g6c3",
        name: "Mundo Artifício RPG",
        tag: "Comunidade",
        description:
          "A comunidade e porta de entrada para todos os demais grupos! Mais de 1000 pessoas acompanham.",
        href: "https://chat.whatsapp.com/BXY5PS8M1YeJkUFas6g6c3",
        kind: "group",
      },
      {
        id: "KHgybxUybiI7SaxKFnvNuN",
        name: "Grupo Artifício RPG",
        tag: "Bate-papo geral",
        description:
          "Grupo onde se fala de todos os RPGs, novidades e conteúdo. Conversar de RPG todo dia, o dia todo. 500 pessoas participam.",
        href: "https://chat.whatsapp.com/KHgybxUybiI7SaxKFnvNuN",
        kind: "group",
      },
      {
        id: "0029Vb4MDR02P59mPJyZ4o1S",
        name: "Canal de Notícias",
        tag: "Canal",
        description:
          "Notícias em primeira mão de RPG: conteúdos, novidades e lançamentos. O canal no Whats que sempre te deixa informado.",
        href: "https://whatsapp.com/channel/0029Vb4MDR02P59mPJyZ4o1S",
        kind: "channel",
      },
    ],
  },
  {
    id: "tematicos",
    title: "Temáticos",
    groups: [
      {
        id: "GaMsCkqo6L67l1brAiDkgs",
        name: "Meus Pergaminhos",
        tag: "D&D 5e / 5.5e",
        description:
          "Tudo sobre D&D 5e e 5.5e. Para quem quer se aprofundar ou compartilhar sobre o sistema. 400 pessoas falando do sistema.",
        href: "https://chat.whatsapp.com/GaMsCkqo6L67l1brAiDkgs",
        kind: "group",
      },
      {
        id: "DhpvBE7Ckc28EMHHHVpRkY",
        name: "Mestres do Dungeon",
        tag: "Mestres de RPG",
        description:
          "Para aqueles que querem falar sobre a arte de ser Mestre de RPG de qualquer sistema.",
        href: "https://chat.whatsapp.com/DhpvBE7Ckc28EMHHHVpRkY",
        kind: "group",
      },
      {
        id: "CNbC2CtiPLALoyjmcjjA1L",
        name: "Forgotten Realms",
        tag: "Cenário",
        description:
          "O cenário mais jogado do mundo tem seu grupo próprio. 300 pessoas conversando sobre aventuras, locais, NPCs e tudo sobre os Reinos Esquecidos.",
        href: "https://chat.whatsapp.com/CNbC2CtiPLALoyjmcjjA1L",
        kind: "group",
      },
      {
        id: "JeiW7FoWHsm5XkIY68gFFp",
        name: "Dragonlance",
        tag: "Cenário",
        description:
          "Um dos cenários mais queridinhos do mundo. Neste grupo, conversamos sobre Dragonlance.",
        href: "https://chat.whatsapp.com/JeiW7FoWHsm5XkIY68gFFp",
        kind: "group",
      },
      {
        id: "L8fscIAbYqH9x8wGC5seO6",
        name: "Greyhawk",
        tag: "Cenário",
        description:
          "O primeiro cenário, lar dos maiores e mais famosos NPCs de D&D — e agora, com a 5.5e, com material próprio.",
        href: "https://chat.whatsapp.com/L8fscIAbYqH9x8wGC5seO6",
        kind: "group",
      },
      {
        id: "ECT3vzTfZoCEPKmZk4veVb",
        name: "Porão do Dungeon",
        tag: "Off-topic livre",
        description:
          "Política, religião, futebol. Só não pode cometer crime. Aqui é o Porão dos nossos grupos, onde as regras são liberadas.",
        href: "https://chat.whatsapp.com/ECT3vzTfZoCEPKmZk4veVb",
        kind: "group",
      },
      {
        id: "CZZJy5XOYhxAC8pXXOJM7m",
        name: "Mesas de RPG",
        tag: "Anúncios de mesa",
        description:
          "Anúncios diários de mesas de RPG para mestres e jogadores.",
        href: "https://chat.whatsapp.com/CZZJy5XOYhxAC8pXXOJM7m",
        kind: "group",
      },
    ],
  },
  {
    id: "parceiros",
    title: "Parceiros",
    groups: [
      {
        id: "E0anhqzl4Y19TOz4eKHfzU",
        name: "Ravenloft",
        tag: "Cenário",
        description:
          "O mais sóbrio dos cenários. Ravenloft tem um grupo com os maiores especialistas do semiplano do pavor. Bem-vindo às brumas!",
        href: "https://chat.whatsapp.com/E0anhqzl4Y19TOz4eKHfzU",
        kind: "group",
      },
      {
        id: "FJCd9vMv5Mi0JYQM5ZWk7p",
        name: "Brainstorm RPG",
        tag: "OSR",
        description:
          "ARKHI é um cenário para Old School Essentials. Um grupo voltado para a galera que curte OSR.",
        href: "https://chat.whatsapp.com/FJCd9vMv5Mi0JYQM5ZWk7p",
        kind: "group",
      },
      {
        id: "KugVwvrKSkmCzG5Z7wDVek",
        name: "RPGistas Remunerados",
        tag: "Mestres de aluguel",
        description:
          "A profissionalização do Mestre de RPG está cada vez mais popular. Aqui, compartilhamos XP sobre como atuar nesta profissão.",
        href: "https://chat.whatsapp.com/KugVwvrKSkmCzG5Z7wDVek",
        kind: "group",
      },
    ],
  },
];

/** Contato para propostas de parceria (página ref: "Como ser Parceiro"). */
export const PARTNER_CONTACT = "https://wa.me/5563992681119";

export const ALL_GROUPS: WhatsappGroup[] = GROUP_CATEGORIES.flatMap((c) => c.groups);
