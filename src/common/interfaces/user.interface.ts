export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}
