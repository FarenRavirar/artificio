import { OAuth2Client } from "google-auth-library";
import type { AccountsEnv } from "./env.js";

export function createGoogleClient(env: AccountsEnv) {
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL,
  );
}

export async function readGoogleProfile(
  client: OAuth2Client,
  idToken: string,
  audience: string,
) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || !payload.name) {
    throw new Error("Google profile incomplete");
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name,
    avatar: payload.picture ?? null,
  };
}
