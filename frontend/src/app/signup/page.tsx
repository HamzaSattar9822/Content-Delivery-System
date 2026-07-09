'use client';

import { FormEvent, useState } from 'react';
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
  useRedirectIfAuthenticated,
} from '@/components/auth/AuthScreen';

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const config = useAuthConfig();
  const { signInWithGoogle, googleLoading, googleError } = useGoogleSignIn();
  useRedirectIfAuthenticated();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    const { error: signUpError } = await authClient.signUp.email({
      email,
      password,
      name: name.trim() || email.split('@')[0],
    });
    if (signUpError) {
      throw new Error(signUpError.message || 'Sign up failed');
    }
    await refresh();
    router.replace('/dashboard');
  };

  const onSubmit = (e: FormEvent) => {
    submitAuthForm(e, handleSignup, setError, setSubmitting);
  };

  const displayError = error ?? googleError;

  return (
    <AuthShell
      title="Create account"
      subtitle="Get started with Content Delivery System."
      footer={
        <>
          Already have an account? <AuthPageLink href="/login">Sign in</AuthPageLink>
        </>
      }
    >
      <AuthFormError error={displayError} />

      {config.googleOauthConfigured && (
        <>
          <GoogleSignInButton onClick={signInWithGoogle} loading={googleLoading} label="Sign up with Google" />
          {config.passwordAuthEnabled && <AuthDivider />}
        </>
      )}

      {config.passwordAuthEnabled && (
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Full name">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </Field>
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
          <PasswordFields
            password={password}
            confirmPassword={confirmPassword}
            onPasswordChange={setPassword}
            onConfirmPasswordChange={setConfirmPassword}
            showConfirm
          />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      )}

      {!config.googleOauthConfigured && !config.passwordAuthEnabled && (
        <p className="text-sm text-muted">Sign up is not available. Contact your administrator.</p>
      )}
    </AuthShell>
  );
}
