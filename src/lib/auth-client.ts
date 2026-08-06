import { createAuthClient } from "better-auth/react";

// Klien Better Auth untuk komponen (sign-in/up/out di /masuk, /daftar, shell).
export const authClient = createAuthClient();
export const { signIn, signUp, signOut, useSession } = authClient;
