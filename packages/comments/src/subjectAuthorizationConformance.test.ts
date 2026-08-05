import { describe, expect, it } from 'vitest';
import {
  authorize,
  refuse,
  type CommentSubjectGuard,
} from './subjectAuthorization.js';
import {
  runSubjectAuthorizationConformance,
  type ConformanceFixtures,
} from './subjectAuthorizationConformance.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';

const fixtures: ConformanceFixtures = {
  commentableWithOwner: {
    label: 'material publicado',
    subject: { subjectType: 'material', subjectId: 'ok' },
    actingUserId: ACTOR,
  },
  commentableWithoutOwner: {
    label: 'post de blog sem conta vinculada',
    subject: { subjectType: 'blog.post', subjectId: 'sem-dono' },
    actingUserId: ACTOR,
  },
  missing: {
    label: 'material inexistente',
    subject: { subjectType: 'material', subjectId: 'nao-existe' },
    actingUserId: ACTOR,
  },
  invisibleToActor: {
    label: 'material em rascunho',
    subject: { subjectType: 'material', subjectId: 'rascunho' },
    actingUserId: ACTOR,
  },
  notCommentable: {
    label: 'material com comentários fechados',
    subject: { subjectType: 'material', subjectId: 'fechado' },
    actingUserId: ACTOR,
  },
  visibleOnlyToActor: {
    label: 'rascunho do próprio ator',
    subject: { subjectType: 'material', subjectId: 'meu-rascunho' },
    actingUserId: ACTOR,
  },
};

/** Guard correto de referência: distingue os cinco casos e consulta o ator. */
const compliantGuard: CommentSubjectGuard = async (subject, actingUserId) => {
  switch (subject.subjectId) {
    case 'ok':
      return authorize({
        exists: true,
        visible: true,
        commentable: true,
        ownerUserId: OWNER,
        canonicalPath: '/materiais/ok',
      });
    case 'sem-dono':
      return authorize({
        exists: true,
        visible: true,
        commentable: true,
        ownerUserId: null,
        canonicalPath: '/blog/sem-dono',
      });
    case 'rascunho':
      // Invisível a todos, inclusive ao ator da fixture.
      return refuse('not_visible');
    case 'meu-rascunho':
      // Visível **só** ao ator: é o que prova que o guard consulta o parâmetro.
      return actingUserId === ACTOR
        ? authorize({
            exists: true,
            visible: true,
            commentable: true,
            ownerUserId: ACTOR,
            canonicalPath: '/materiais/meu-rascunho',
          })
        : refuse('not_visible');
    case 'fechado':
      return refuse('not_commentable');
    default:
      return refuse('not_found');
  }
};

describe('runSubjectAuthorizationConformance', () => {
  it('aprova guard correto', async () => {
    const report = await runSubjectAuthorizationConformance(compliantGuard, fixtures);
    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(6);
  });

  it('reprova guard permissivo — o caso que o tipo sozinho não pega', async () => {
    const permissive: CommentSubjectGuard = async () =>
      authorize({
        exists: true,
        visible: true,
        commentable: true,
        ownerUserId: OWNER,
        canonicalPath: '/x',
      });

    const report = await runSubjectAuthorizationConformance(permissive, fixtures);
    expect(report.passed).toBe(false);
    expect(report.checks.filter((check) => !check.passed).length).toBeGreaterThanOrEqual(4);
  });

  it('reprova guard que recusa tudo', async () => {
    const denyAll: CommentSubjectGuard = async () => refuse('not_found');
    const report = await runSubjectAuthorizationConformance(denyAll, fixtures);

    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === 'alvo comentável é autorizado')?.passed).toBe(false);
  });

  it('reprova guard que nunca consulta o ator — o defeito comum', async () => {
    // Este guard IGNORA `actingUserId` por completo: decide só por `subjectId`.
    // É o formato que uma implementação apressada assume, e o que a primeira
    // versão desta suíte **aprovava** — ela só checava que o alvo invisível era
    // recusado para um estranho, e um guard que ignora o ator recusa aquele
    // alvo para todo mundo. Medido antes da correção: `passed: true`.
    const ignoresActor: CommentSubjectGuard = async (subject) => {
      switch (subject.subjectId) {
        case 'ok':
          return authorize({
            exists: true,
            visible: true,
            commentable: true,
            ownerUserId: OWNER,
            canonicalPath: '/materiais/ok',
          });
        case 'sem-dono':
          return authorize({
            exists: true,
            visible: true,
            commentable: true,
            ownerUserId: null,
            canonicalPath: '/blog/sem-dono',
          });
        case 'meu-rascunho':
          // Sem consultar o ator, a única saída é autorizar para todos...
          return authorize({
            exists: true,
            visible: true,
            commentable: true,
            ownerUserId: ACTOR,
            canonicalPath: '/materiais/meu-rascunho',
          });
        case 'rascunho':
          return refuse('not_visible');
        case 'fechado':
          return refuse('not_commentable');
        default:
          return refuse('not_found');
      }
    };

    const report = await runSubjectAuthorizationConformance(ignoresActor, fixtures);

    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === 'visibilidade considera o ator')?.passed).toBe(false);
  });

  it('reprova guard que recusa o alvo ao próprio ator', async () => {
    // ...e a outra saída de quem ignora o ator é recusar para todos, que a
    // suíte também precisa pegar — senão bastaria negar tudo para passar.
    const deniesOwnDraft: CommentSubjectGuard = async (subject, actingUserId) =>
      subject.subjectId === 'meu-rascunho'
        ? refuse('not_visible')
        : compliantGuard(subject, actingUserId);

    const report = await runSubjectAuthorizationConformance(deniesOwnDraft, fixtures);
    expect(report.passed).toBe(false);
  });

  it('sinaliza lacuna quando o app não fornece a fixture sensível ao ator', async () => {
    const withoutActorFixture = { ...fixtures };
    delete withoutActorFixture.visibleOnlyToActor;

    const report = await runSubjectAuthorizationConformance(compliantGuard, withoutActorFixture);

    // Passa, mas declara que a cobertura mais importante não foi exercida —
    // silêncio aqui leria como "guard correto".
    expect(report.passed).toBe(true);
    expect(report.actorSensitivityCovered).toBe(false);
  });

  it('declara cobertura do ator quando a fixture existe', async () => {
    const report = await runSubjectAuthorizationConformance(compliantGuard, fixtures);
    expect(report.actorSensitivityCovered).toBe(true);
  });

  it('reprova dono fictício em conteúdo sem conta vinculada', async () => {
    const inventsOwner: CommentSubjectGuard = async (subject, actingUserId) =>
      subject.subjectId === 'sem-dono'
        ? authorize({
            exists: true,
            visible: true,
            commentable: true,
            ownerUserId: OWNER,
            canonicalPath: '/blog/sem-dono',
          })
        : compliantGuard(subject, actingUserId);

    const report = await runSubjectAuthorizationConformance(inventsOwner, fixtures);
    expect(report.passed).toBe(false);
    expect(
      report.checks.find((check) => check.name.startsWith('alvo sem dono'))?.passed,
    ).toBe(false);
  });

  it('reprova guard que confunde invisível com inexistente', async () => {
    const conflates: CommentSubjectGuard = async (subject, actingUserId) =>
      subject.subjectId === 'rascunho'
        ? refuse('not_found')
        : compliantGuard(subject, actingUserId);

    const report = await runSubjectAuthorizationConformance(conflates, fixtures);
    expect(report.passed).toBe(false);
  });

  it('não exige a fixture opcional de conteúdo sem dono', async () => {
    const withoutOptional = { ...fixtures };
    delete withoutOptional.commentableWithoutOwner;
    const report = await runSubjectAuthorizationConformance(compliantGuard, withoutOptional);

    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(5);
  });

  it('não ecoa payload no detalhe da falha', async () => {
    const denyAll: CommentSubjectGuard = async () => refuse('not_found');
    const report = await runSubjectAuthorizationConformance(denyAll, fixtures);

    for (const check of report.checks) {
      expect(check.detail ?? '').not.toContain('canonicalPath');
    }
  });
});
