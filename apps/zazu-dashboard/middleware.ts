export { auth as middleware } from "./auth";

export const config = {
  // Exclude auth-related routes, static files, and icons from the middleware
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
