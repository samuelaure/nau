import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Exclude auth-related routes, static files, and icons from the middleware
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
