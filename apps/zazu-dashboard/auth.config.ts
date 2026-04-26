import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthRoute =
        nextUrl.pathname === "/login" ||
        nextUrl.pathname.startsWith("/auth/callback") ||
        nextUrl.pathname.startsWith("/auth/link-callback");

      if (isAuthRoute) {
        if (isLoggedIn && nextUrl.pathname === "/login")
          return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      return isLoggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
