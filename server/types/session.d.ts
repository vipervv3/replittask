import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    user?: {
      id: string;
      name: string;
      email: string;
      username: string;
    };
    webauthnChallenge?: string;
    webauthnUserId?: string;
  }
}