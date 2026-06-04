export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  exp: number;
  avatar?: string | null;
}
