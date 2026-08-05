import {
  normalizeGuardResult,
  type CommentSubjectGuard,
  type CommentSubjectRef,
  type SubjectRefusalReason,
} from './subjectAuthorization.js';

/**
 * T2.2 — suíte de conformidade reutilizável (decisão 2).
 *
 * ## Por que uma suíte e não só um tipo
 *
 * O tipo `CommentSubjectGuard` obriga a assinatura, não o comportamento. Um
 * guard que responda `authorized: true` para tudo satisfaz o tipo e destrói a
 * garantia inteira — o `accounts.` confia na afirmação porque ela vem por
 * credencial de serviço, então um guard permissivo é escrita autorizada em
 * assunto que não existe.
 *
 * Esta suíte é o que cada app roda **contra a própria implementação**, na sua
 * fase de adoção, com os próprios dados de teste. Ela é agnóstica de runner:
 * devolve uma lista de resultados, e o app decide se falha o `it()` do vitest,
 * do jest ou de outro. Assim o pacote não arrasta runner de teste para as
 * dependências de produção de ninguém.
 *
 * ## O que ela não faz
 *
 * Não substitui os testes de domínio do app. Ela cobre os invariantes que são
 * iguais nos três consumidores; regra específica (mesa de grupo fechado,
 * material em rascunho) continua sendo teste do app.
 */

export interface ConformanceFixture {
  /** Rótulo humano, aparece no resultado. */
  label: string;
  subject: CommentSubjectRef;
  actingUserId: string;
}

/**
 * Fixtures que o app fornece. Cada campo é um cenário que a implementação dele
 * precisa distinguir — quem monta os dados é quem conhece o domínio.
 */
export interface ConformanceFixtures {
  /** Alvo real, visível e aberto a comentário, com dono vinculado. */
  commentableWithOwner: ConformanceFixture;
  /**
   * Alvo real, visível e comentável, **sem** conta vinculada. Legítimo: post
   * do blog e mesa órfã. Opcional — nem todo app tem esse caso.
   */
  commentableWithoutOwner?: ConformanceFixture;
  /** `subject_id` que não existe naquele app. */
  missing: ConformanceFixture;
  /** Existe, mas o ator não pode ver (rascunho, privado, arquivado). */
  invisibleToActor: ConformanceFixture;
  /** Existe e é visível, mas não aceita comentário (fechado, bloqueado). */
  notCommentable: ConformanceFixture;
  /**
   * Alvo **visível e comentável para `actingUserId`, invisível para terceiro** —
   * rascunho do próprio autor, mesa de grupo fechado onde o ator é membro,
   * material privado do próprio criador.
   *
   * Sem esta fixture não existe como detectar o defeito mais comum: um guard
   * que **nunca consulta o ator**. Ele recusa `invisibleToActor` para todo
   * mundo e por isso passa em qualquer checagem construída só sobre aquele
   * alvo — inclusive na que existia aqui antes e que este campo substitui.
   *
   * Opcional porque nem todo app tem visibilidade por ator; quando ausente, a
   * suíte **reporta a lacuna** em vez de fingir cobertura (ver
   * `actorSensitivityCovered` no relatório).
   */
  visibleOnlyToActor?: ConformanceFixture;
}

export interface ConformanceCheck {
  name: string;
  passed: boolean;
  /** Preenchido só quando falha. Nunca ecoa dado do payload. */
  detail?: string;
}

export interface ConformanceReport {
  checks: ConformanceCheck[];
  passed: boolean;
  /**
   * `false` quando o app não forneceu `visibleOnlyToActor` — a suíte então
   * **não** verificou se o guard consulta o ator.
   *
   * Existe para que a lacuna seja visível: `passed: true` com
   * `actorSensitivityCovered: false` significa "passou no que foi testado",
   * não "o guard está correto". App com visibilidade por ator que deixe este
   * campo `false` está sem a cobertura que mais importa.
   */
  actorSensitivityCovered: boolean;
}

async function expectRefusal(
  guard: CommentSubjectGuard,
  fixture: ConformanceFixture,
  expected: SubjectRefusalReason,
  name: string,
): Promise<ConformanceCheck> {
  const result = normalizeGuardResult(
    await guard(fixture.subject, fixture.actingUserId),
  );

  if (result.authorized) {
    return {
      name,
      passed: false,
      detail: `${fixture.label}: guard autorizou; esperado recusar com "${expected}"`,
    };
  }

  // O motivo exato importa menos que a recusa, mas divergência sistemática
  // indica guard que não distingue os casos — e um guard que não distingue
  // "invisível" de "inexistente" costuma estar respondendo por existência
  // apenas, que é o vazamento.
  if (result.reason !== expected) {
    return {
      name,
      passed: false,
      detail: `${fixture.label}: recusou com "${result.reason}", esperado "${expected}"`,
    };
  }

  return { name, passed: true };
}

/**
 * Roda a suíte contra um guard. Não lança: devolve o relatório para o runner do
 * app decidir como falhar.
 */
export async function runSubjectAuthorizationConformance(
  guard: CommentSubjectGuard,
  fixtures: ConformanceFixtures,
): Promise<ConformanceReport> {
  const checks: ConformanceCheck[] = [];

  // 1. Caminho feliz — sem isto, um guard que recusa tudo passaria nos demais.
  {
    const fixture = fixtures.commentableWithOwner;
    const result = normalizeGuardResult(
      await guard(fixture.subject, fixture.actingUserId),
    );

    if (!result.authorized) {
      checks.push({
        name: 'alvo comentável é autorizado',
        passed: false,
        detail: `${fixture.label}: recusado com "${result.reason}"`,
      });
    } else if (result.authorization.ownerUserId === null) {
      checks.push({
        name: 'alvo comentável é autorizado',
        passed: false,
        detail: `${fixture.label}: ownerUserId veio nulo numa fixture com dono — badge de autor e notificação de publicação dependem dele`,
      });
    } else {
      checks.push({ name: 'alvo comentável é autorizado', passed: true });
    }
  }

  // 2. Dono ausente é caso legítimo, não erro (requisitos 15a, 15b).
  if (fixtures.commentableWithoutOwner) {
    const fixture = fixtures.commentableWithoutOwner;
    const result = normalizeGuardResult(
      await guard(fixture.subject, fixture.actingUserId),
    );

    checks.push(
      !result.authorized
        ? {
            name: 'alvo sem dono vinculado é autorizado com ownerUserId nulo',
            passed: false,
            detail: `${fixture.label}: recusado com "${result.reason}"; conteúdo sem conta vinculada continua comentável`,
          }
        : result.authorization.ownerUserId !== null
          ? {
              name: 'alvo sem dono vinculado é autorizado com ownerUserId nulo',
              passed: false,
              detail: `${fixture.label}: devolveu dono onde não há conta vinculada — dono fictício vira destinatário de notificação inventado`,
            }
          : {
              name: 'alvo sem dono vinculado é autorizado com ownerUserId nulo',
              passed: true,
            },
    );
  }

  // 3-5. As três recusas.
  checks.push(
    await expectRefusal(
      guard,
      fixtures.missing,
      'not_found',
      'assunto inexistente é recusado',
    ),
  );
  checks.push(
    await expectRefusal(
      guard,
      fixtures.invisibleToActor,
      'not_visible',
      'assunto invisível ao ator é recusado',
    ),
  );
  checks.push(
    await expectRefusal(
      guard,
      fixtures.notCommentable,
      'not_commentable',
      'assunto fechado a comentário é recusado',
    ),
  );

  // 6. O guard precisa **consultar** o ator, não só recebê-lo.
  //
  // A checagem exige um alvo que o ator VÊ e um estranho NÃO vê, e compara as
  // duas respostas. Só a divergência prova consulta: um guard que ignora
  // `actingUserId` devolve a mesma coisa nas duas chamadas.
  //
  // Versão anterior desta checagem usava `invisibleToActor` e só verificava que
  // o estranho era recusado. Estava furada: guard que ignora o ator recusa
  // aquele alvo para todo mundo e passava. Medido — a suíte aprovava um guard
  // que nunca lê o parâmetro.
  const actorSensitivityCovered = fixtures.visibleOnlyToActor !== undefined;

  if (fixtures.visibleOnlyToActor) {
    const fixture = fixtures.visibleOnlyToActor;
    const stranger = '00000000-0000-4000-8000-000000000000';

    const asActor = normalizeGuardResult(
      await guard(fixture.subject, fixture.actingUserId),
    );
    const asStranger = normalizeGuardResult(
      await guard(fixture.subject, stranger),
    );

    const name = 'visibilidade considera o ator';

    if (!asActor.authorized) {
      checks.push({
        name,
        passed: false,
        detail: `${fixture.label}: recusado com "${asActor.reason}" para o próprio ator, que deveria enxergar o alvo`,
      });
    } else if (asStranger.authorized) {
      checks.push({
        name,
        passed: false,
        detail: `${fixture.label}: autorizado também para ator estranho — o guard não consulta actingUserId, e conteúdo restrito vira comentável por qualquer conta`,
      });
    } else {
      checks.push({ name, passed: true });
    }
  }

  return {
    checks,
    passed: checks.every((check) => check.passed),
    actorSensitivityCovered,
  };
}
