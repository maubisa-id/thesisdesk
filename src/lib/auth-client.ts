import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

// Klien Better Auth untuk komponen (sign-in/up/out di /masuk, /daftar, shell).
export const authClient = createAuthClient({ plugins: [genericOAuthClient()] });
export const { signIn, signUp, signOut, useSession } = authClient;
