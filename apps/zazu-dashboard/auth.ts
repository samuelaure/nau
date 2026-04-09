import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "crypto";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || "5109114390";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "telegram-login",
      name: "Telegram Mini App",
      credentials: {
        initData: { label: "Init Data", type: "text" },
      },
      async authorize(credentials) {
        const initData = credentials?.initData as string;
        if (!initData) return null;

        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return null;

        // 1. Verify Telegram InitData Hash
        try {
          const urlParams = new URLSearchParams(initData);
          const hash = urlParams.get("hash");
          urlParams.delete("hash");

          // Sort alphabetic
          const params = Array.from(urlParams.entries())
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join("\n");

          const secretKey = crypto
            .createHmac("sha256", "WebAppData")
            .update(token)
            .digest();

          const calculatedHash = crypto
            .createHmac("sha256", secretKey)
            .update(params)
            .digest("hex");

          if (calculatedHash !== hash) {
            console.error("Telegram Auth: Hash mismatch");
            return null;
          }

          // 2. Extract user info
          const userStr = urlParams.get("user");
          if (!userStr) return null;
          const tgUser = JSON.parse(userStr);

          const tgUserId = tgUser.id.toString();
          const isAdmin = tgUserId === ADMIN_TELEGRAM_ID;

          return { 
            id: tgUserId, 
            name: tgUser.first_name, 
            image: tgUser.photo_url,
            // NextAuth needs this as a string, we will map it in jwt backend
            isAdminString: isAdmin ? "true" : "false"
          };
        } catch (e) {
          console.error("Telegram Auth Error:", e);
          return null;
        }
      },
    }),
    Credentials({
      id: "credentials",
      name: "Zazŭ Access",
      credentials: {
        password: { label: "Security Key", type: "password" },
      },
      async authorize(credentials) {
        const admin_password = process.env.ADMIN_PASSWORD || "zazu_secure_2026";
        
        if (credentials?.password === admin_password) {
          return { 
            id: "1", 
            name: "Zazŭ Administrator", 
            email: "admin@zazu.localhost",
            isAdminString: "true"
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as any).isAdminString === "true";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.id as string;
        session.user.isAdmin = !!token.isAdmin;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      
      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true; // Allow access to login page
      }
      
      return isLoggedIn; // Require login for all other pages
    },
  },
});
