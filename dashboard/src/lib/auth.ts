import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { prisma } from '@/lib/prisma';

// Pre-computed dummy hash for timing-attack mitigation
// This ensures bcrypt.compare() always runs, even if user doesn't exist
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-attack-mitigation', 12);

const rateLimiter = new RateLimiterMemory({
  points: 5,        // 5 login attempts
  duration: 15 * 60, // per 15 minutes
  keyPrefix: 'login_attempt',
});

export const authConfig: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Rate limiting by email
        try {
          await rateLimiter.consume(credentials.email);
        } catch {
          throw new Error('Too many login attempts. Please try again in 15 minutes.');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            memberships: {
              include: { tenant: true },
              take: 1,
            },
          },
        });

        // Always run bcrypt.compare to prevent timing attacks
        const hashToCompare = user?.hashedPassword ?? DUMMY_HASH;
        const isValid = await bcrypt.compare(credentials.password, hashToCompare);

        if (!user || !isValid) {
          return null;
        }

        const primaryMembership = user.memberships[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tenantId: primaryMembership?.tenantId ?? null,
          tenantSlug: primaryMembership?.tenant?.slug ?? null,
          role: primaryMembership?.role ?? user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantId = (user as { tenantId?: string | null }).tenantId ?? null;
        token.tenantSlug = (user as { tenantSlug?: string | null }).tenantSlug ?? null;
        token.role = (user as { role?: string }).role ?? 'user';
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string;
        session.user.tenantId = token.tenantId as string | null;
        session.user.tenantSlug = token.tenantSlug as string | null;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
