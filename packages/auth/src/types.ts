export type UserRole = "user" | "moderator" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roleVersion?: number;
  avatar?: string | null;
}

export interface Session {
  user: User;
  exp: number;
}

export interface JwtClaims {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  role_version?: number;
  exp: number;
  avatar?: string | null;
}
