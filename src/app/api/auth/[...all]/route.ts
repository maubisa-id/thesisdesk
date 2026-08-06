import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Handler Better Auth (semua endpoint /api/auth/*: sign-in, sign-up, sign-out, session, dst).
export const { GET, POST } = toNextJsHandler(auth);
