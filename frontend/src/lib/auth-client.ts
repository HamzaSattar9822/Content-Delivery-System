import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client. Auth lives on the Express backend (at ${API}/api/auth),
 * so the client targets the backend origin and sends credentials cross-site
 * (the session cookie is first-party to the backend on Render).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: 'include' },
});

export const { signIn, signUp, signOut, useSession } = authClient;
