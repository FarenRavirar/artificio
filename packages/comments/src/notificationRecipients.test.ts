import { describe, expect, it } from 'vitest';
import {
  resolveNotificationRecipients,
  type RecipientCandidates,
} from './notificationRecipients.js';

const ATOR = 'ator';
const PUBLICADOR = 'publicador';
const AUTOR_DO_PAI = 'autor-do-pai';

describe('T2.6b — menção não cria destinatário (decisão 31)', () => {
  it('o conjunto de entrada não tem por onde uma menção entrar', () => {
    // A garantia é **estrutural**, não uma regra a lembrar: `RecipientCandidates`
    // carrega publicador, autor do pai, ator e inelegíveis — o corpo do
    // comentário não é parâmetro, então nenhum `@texto` tem caminho até um
    // `notification_receipt`.
    //
    // A guarda é no **tipo**, não no literal. Até 2026-08-09 este teste rodava
    // `Object.keys` sobre o objeto local abaixo, o que não guardava nada:
    // acrescentar `bodyMarkdown` a `RecipientCandidates` deixava o literal
    // intacto e o teste seguia verde — enquanto o comentário afirmava o
    // contrário. A lista também estava errada, com três campos para um tipo de
    // quatro (achado de review do CodeRabbit, PR #250).
    //
    // Agora um campo novo sai de `CamposPermitidos`, `Excedentes` deixa de ser
    // `never`, e o **pacote não compila** — que é exatamente o momento em que a
    // decisão 31 estaria sendo revogada sem decisão.
    type CamposPermitidos =
      | 'publisherUserId'
      | 'parentAuthorUserId'
      | 'actingUserId'
      | 'ineligibleUserIds';
    type Excedentes = Exclude<keyof RecipientCandidates, CamposPermitidos>;
    const semCampoDeTexto: Excedentes extends never ? true : false = true;
    expect(semCampoDeTexto).toBe(true);

    const candidatos: RecipientCandidates = {
      publisherUserId: null,
      parentAuthorUserId: null,
      actingUserId: ATOR,
    };

    // Raiz de um assunto sem dono, com menção no corpo: ninguém é notificado.
    expect(resolveNotificationRecipients(candidatos)).toEqual([]);
  });
});

describe('resolveNotificationRecipients', () => {
  it('raiz notifica o publicador do conteúdo', () => {
    expect(
      resolveNotificationRecipients({
        publisherUserId: PUBLICADOR,
        parentAuthorUserId: null,
        actingUserId: ATOR,
      }),
    ).toEqual([PUBLICADOR]);
  });

  it('resposta notifica autor do pai E publicador (requisito 15c)', () => {
    // Os requisitos 14 e 15 se sobrepõem numa resposta. O grilling fixou o
    // conjunto: não é "ou um ou outro".
    expect(
      resolveNotificationRecipients({
        publisherUserId: PUBLICADOR,
        parentAuthorUserId: AUTOR_DO_PAI,
        actingUserId: ATOR,
      }),
    ).toEqual([PUBLICADOR, AUTOR_DO_PAI]);
  });

  it('publicador que também escreveu o pai recebe UM recibo', () => {
    // `feito quando`: "pai e publicador iguais produzem um recibo". Dois recibos
    // seriam dois sinos para o mesmo fato.
    expect(
      resolveNotificationRecipients({
        publisherUserId: PUBLICADOR,
        parentAuthorUserId: PUBLICADOR,
        actingUserId: ATOR,
      }),
    ).toEqual([PUBLICADOR]);
  });

  describe('o ator nunca se notifica (requisito 16)', () => {
    it('comentando no próprio conteúdo', () => {
      expect(
        resolveNotificationRecipients({
          publisherUserId: ATOR,
          parentAuthorUserId: null,
          actingUserId: ATOR,
        }),
      ).toEqual([]);
    });

    it('respondendo ao próprio comentário', () => {
      expect(
        resolveNotificationRecipients({
          publisherUserId: null,
          parentAuthorUserId: ATOR,
          actingUserId: ATOR,
        }),
      ).toEqual([]);
    });

    it('respondendo a si mesmo no próprio conteúdo', () => {
      expect(
        resolveNotificationRecipients({
          publisherUserId: ATOR,
          parentAuthorUserId: ATOR,
          actingUserId: ATOR,
        }),
      ).toEqual([]);
    });

    it('mas o outro participante continua recebendo', () => {
      // Autor do pai é o próprio ator, publicador é outro: o publicador recebe.
      expect(
        resolveNotificationRecipients({
          publisherUserId: PUBLICADOR,
          parentAuthorUserId: ATOR,
          actingUserId: ATOR,
        }),
      ).toEqual([PUBLICADOR]);
    });
  });

  describe('conteúdo sem conta vinculada não inventa destinatário (15a, 15b)', () => {
    it('post do blog: comentar não notifica ninguém', () => {
      // `site.posts` não tem `author_user_id`. Lista vazia é resultado normal,
      // não falha — a limitação é registrada, não contornada com dono fictício.
      expect(
        resolveNotificationRecipients({
          publisherUserId: null,
          parentAuthorUserId: null,
          actingUserId: ATOR,
        }),
      ).toEqual([]);
    });

    it('post do blog: responder AINDA notifica quem escreveu o pai', () => {
      // É o que preserva a conversa mesmo sem dono do conteúdo.
      expect(
        resolveNotificationRecipients({
          publisherUserId: null,
          parentAuthorUserId: AUTOR_DO_PAI,
          actingUserId: ATOR,
        }),
      ).toEqual([AUTOR_DO_PAI]);
    });
  });

  describe('conta inelegível não recebe (15c)', () => {
    it('publicador removido ou bloqueado é excluído', () => {
      expect(
        resolveNotificationRecipients({
          publisherUserId: PUBLICADOR,
          parentAuthorUserId: AUTOR_DO_PAI,
          actingUserId: ATOR,
          ineligibleUserIds: [PUBLICADOR],
        }),
      ).toEqual([AUTOR_DO_PAI]);
    });

    it('todos inelegíveis produz lista vazia, não erro', () => {
      expect(
        resolveNotificationRecipients({
          publisherUserId: PUBLICADOR,
          parentAuthorUserId: AUTOR_DO_PAI,
          actingUserId: ATOR,
          ineligibleUserIds: [PUBLICADOR, AUTOR_DO_PAI],
        }),
      ).toEqual([]);
    });

    it('lista de inelegíveis vazia não exclui ninguém', () => {
      expect(
        resolveNotificationRecipients({
          publisherUserId: PUBLICADOR,
          parentAuthorUserId: AUTOR_DO_PAI,
          actingUserId: ATOR,
          ineligibleUserIds: [],
        }),
      ).toEqual([PUBLICADOR, AUTOR_DO_PAI]);
    });
  });

  it('a ordem é estável, para o INSERT em lote ser determinístico', () => {
    const primeira = resolveNotificationRecipients({
      publisherUserId: PUBLICADOR,
      parentAuthorUserId: AUTOR_DO_PAI,
      actingUserId: ATOR,
    });
    const segunda = resolveNotificationRecipients({
      publisherUserId: PUBLICADOR,
      parentAuthorUserId: AUTOR_DO_PAI,
      actingUserId: ATOR,
    });

    expect(primeira).toEqual(segunda);
  });

  it('nunca devolve duplicata, qualquer que seja a combinação', () => {
    // Guarda contra uma futura terceira origem de destinatário entrar sem passar
    // pela dedupe: a unicidade do banco é a segunda barreira, não a primeira.
    for (const publisherUserId of [null, ATOR, PUBLICADOR]) {
      for (const parentAuthorUserId of [null, ATOR, PUBLICADOR, AUTOR_DO_PAI]) {
        const recipients = resolveNotificationRecipients({
          publisherUserId,
          parentAuthorUserId,
          actingUserId: ATOR,
        });

        expect(new Set(recipients).size).toBe(recipients.length);
        expect(recipients).not.toContain(ATOR);
      }
    }
  });
});
