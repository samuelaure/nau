import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "crypto";
import { jwtVerify } from "jose";
import prisma from "@zazu/db";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      isAdmin: boolean;
      nauUserId: string | null;
    } & DefaultSession["user"];
  }
}

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || "5109114390";
const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

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

        try {
          const urlParams = new URLSearchParams(initData);
          const hash = urlParams.get("hash");
          urlParams.delete("hash");

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

          const userStr = urlParams.get("user");
          if (!userStr) return null;
          const tgUser = JSON.parse(userStr);

          const tgUserId = tgUser.id.toString();
          const isAdmin = tgUserId === ADMIN_TELEGRAM_ID;

          const dbUser = await prisma.user.findUnique({
            where: { telegramId: BigInt(tgUser.id) },
            select: { nauUserId: true },
          });

          return {
            id: tgUserId,
            name: tgUser.first_name,
            image: tgUser.photo_url,
            isAdminString: isAdmin ? "true" : "false",
            nauUserId: dbUser?.nauUserId ?? null,
          };
        } catch (e) {
          console.error("Telegram Auth Error:", e);
          return null;
        }
      },
    }),
    Credentials({
      id: "nau-sso",
      name: "naŭ SSO",
      credentials: {
        token: { label: "JWT Token", type: "text" },
      },
      async authorize(credentials) {
        const jwtToken = credentials?.token as string;
        if (!jwtToken) return null;

        try {
          const secret = new TextEncoder().encode(JWT_SECRET);
          const { payload } = await jwtVerify(jwtToken, secret);
          if (!payload.sub) return null;

          return {
            id: payload.sub,
            name: (payload.name as string) ?? "naŭ User",
            email: payload.email as string | undefined,
            isAdminString: "true",
          };
        } catch {
          return null;
        }
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
        token.nauUserId = (user as any).nauUserId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.id as string;
        session.user.isAdmin = !!token.isAdmin;
        session.user.nauUserId = (token.nauUserId as string | null) ?? null;
      }
      return session;
    },
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
});
