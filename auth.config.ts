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
      if ((user as { role?: string })?.role) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },

    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      if (token.role) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },

    /**
     * authorized — called by middleware to guard protected routes.
     * Runs in Edge Runtime — must not use any Node.js-only APIs.
     */
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user?.id;
      const role = (session?.user as { role?: string } | undefined)?.role;
      const path = nextUrl.pathname;

      // ── Role-based redirects for authenticated users ─────────────────────
      if (isLoggedIn) {
        // Admin users: redirect to /admin from root, /login, /register, or /dashboard
        if (role === "admin") {
          if (
            path === "/" ||
            path === "/login" ||
            path === "/register" ||
            path.startsWith("/dashboard")
          ) {
            return Response.redirect(new URL("/admin", nextUrl));
          }
        }

        // Driver users: redirect to /dashboard from root
        if (role === "driver" && path === "/") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }

        // Driver on admin path → redirect to /dashboard
        if (role === "driver" && path.startsWith("/admin")) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }

      // ── Protected path guard ──────────────────────────────────────────────
      const protectedPaths = ["/dashboard", "/map", "/messages", "/stress", "/friends", "/profile", "/calls"];
      const isOnProtected = protectedPaths.some((p) =>
        path.startsWith(p)
      );
      if (isOnProtected) return isLoggedIn;

      // ── Admin route guard ─────────────────────────────────────────────────
      if (path.startsWith("/admin")) {
        if (!isLoggedIn) return Response.redirect(new URL("/login", nextUrl));
        if (role !== "admin") return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      return true;
    },
  },
};
