import type { NextAuthConfig } from "next-auth";

/**
 * auth.config.ts — Edge-safe Auth.js configuration.
 *
 * Contains ONLY callbacks and settings that are safe to run in the Edge Runtime.
 * NO bcryptjs, NO postgres/Drizzle imports — those live in auth.ts only.
 *
 * Used by:
 *  - middleware.ts (Edge Runtime)
 *
 * auth.ts extends this config and adds the full Credentials provider with DB access.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [],
  // Credentials provider is added in auth.ts (Node.js runtime only)

  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },

    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },

    /**
     * authorized — called by middleware to guard protected routes.
     * Runs in Edge Runtime — must not use any Node.js-only APIs.
     */
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user?.id;
      const protectedPaths = ["/dashboard", "/map", "/messages", "/stress"];
      const isOnProtected = protectedPaths.some((p) =>
        nextUrl.pathname.startsWith(p)
      );
      if (isOnProtected) return isLoggedIn;
      return true;
    },
  },
};
