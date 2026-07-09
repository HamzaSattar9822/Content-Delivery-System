'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { authClient } from '@/lib/auth-client';
import { Button, Field, Input } from '@/components/ui';
import {
  AuthDivider,
  AuthFormError,
  AuthPageLink,
  AuthShell,
  GoogleSignInButton,
  PasswordFields,
  submitAuthForm,
  useAuthConfig,
  useGoogleSignIn,
  useOAuthErrorFromQuery,
  useRedirectIfAuthenticated,
} from '@/components/auth/AuthScreen';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const config = useAuthConfig();
  const oauthError = useOAuthErrorFromQuery();
  const { signInWithGoogle, googleLoading, googleError } = useGoogleSignIn();
  useRedirectIfAuthenticated();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (oauthError) setError(oauthError);
  }, [oauthError]);

  const handleLogin = async () => {
    const { error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      throw new Error(signInError.message || 'Invalid email or password');
    }
    await refresh();
    router.replace('/dashboard');
  };

  const onSubmit = (e: FormEvent) => {
    submitAuthForm(e, handleLogin, setError, setSubmitting);
  };

  const displayError = error ?? googleError;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Sign in to manage your content."
      footer={
        <>
          Don&apos;t have an account? <AuthPageLink href="/signup">Create one</AuthPageLink>
        </>
      }
    >
      <AuthFormError error={displayError} />

      {config.googleOauthConfigured && (
        <>
          <GoogleSignInButton onClick={signInWithGoogle} loading={googleLoading} />
          {config.passwordAuthEnabled && <AuthDivider />}
        </>
      )}

      {config.passwordAuthEnabled && (
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Email address">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>
          <PasswordFields password={password} onPasswordChange={setPassword} />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      )}

      {!config.googleOauthConfigured && !config.passwordAuthEnabled && (
        <p className="text-sm text-muted">No authentication method is configured.</p>
      )}
    </AuthShell>
  );
}
