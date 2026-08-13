import { describe, expect, it } from "vitest";
import {
  COMMUNITY_NEW_ACCOUNT_MAX_AGE_MS,
  COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT,
  classifyCommunityAccount,
} from "./communityNewAccount.js";

const NOW = new Date("2026-08-12T12:00:00.000Z");

describe("classificação de conta nova (T4.20)", () => {
  it("considera nova por idade mesmo depois do terceiro comentário", () => {
    const createdAt = new Date(NOW.getTime() - COMMUNITY_NEW_ACCOUNT_MAX_AGE_MS + 1);
    const status = classifyCommunityAccount(
      createdAt,
      COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT,
      NOW,
    );

    expect(status).toMatchObject({ isNew: true, accountIsYoung: true, commentCountIsLow: false });
  });

  it("considera nova por contagem mesmo depois de sete dias", () => {
    const createdAt = new Date(NOW.getTime() - COMMUNITY_NEW_ACCOUNT_MAX_AGE_MS);
    const status = classifyCommunityAccount(
      createdAt,
      COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT - 1,
      NOW,
    );

    expect(status).toMatchObject({ isNew: true, accountIsYoung: false, commentCountIsLow: true });
  });

  it("deixa de ser nova somente ao cumprir as duas fronteiras", () => {
    const createdAt = new Date(NOW.getTime() - COMMUNITY_NEW_ACCOUNT_MAX_AGE_MS);
    const status = classifyCommunityAccount(
      createdAt,
      COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT,
      NOW,
    );

    expect(status).toMatchObject({ isNew: false, accountIsYoung: false, commentCountIsLow: false });
  });
});
