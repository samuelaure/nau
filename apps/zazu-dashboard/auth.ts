import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Zazŭ Access",
      credentials: {
        password: { label: "Security Key", type: "password" },
      },
      async authorize(credentials) {
        const admin_password = process.env.ADMIN_PASSWORD || "zazu_secure_2026";
        
        if (credentials?.password === admin_password) {
          return { id: "1", name: "Zazŭ Administrator", email: "admin@zazu.localhost" };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname !== "/login";
      
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
});
