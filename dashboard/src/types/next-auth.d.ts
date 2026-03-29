import { DefaultSession, DefaultJWT } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tenantId: string | null;
      tenantSlug: string | null;
      role: string;
    } & DefaultSession['user'];
  }

  interface User {
    tenantId?: string | null;
    tenantSlug?: string | null;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userId: string;
    tenantId: string | null;
    tenantSlug: string | null;
    role: string;
  }
}
