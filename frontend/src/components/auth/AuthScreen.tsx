'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { authClient } from '@/lib/auth-client';
import { Banner, Button, Card, Field, PasswordInput } from '@/components/ui';
import { useTheme } from '@/lib/theme';

export interface AuthConfig {
  googleOauthConfigured: boolean;
  passwordAuthEnabled: boolean;
}

const OAUTH_ERRORS: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled.',
  missing_code: 'Google sign-in did not complete. Please try again.',
  invalid_state: 'Google sign-in session expired. Please try again.',
  oauth_failed: 'Google sign-in failed. Check your OAuth configuration.',
  unauthorized: 'Your Google account is not authorized to access this system.',
};

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * Auth method availability. Password auth is always on. Google is shown when
 * NEXT_PUBLIC_GOOGLE_AUTH=true and the backend reports OAuth credentials are set.
 */
export function useAuthConfig(): AuthConfig {
  const [config, setConfig] = useState<AuthConfig>({
    passwordAuthEnabled: true,
    googleOauthConfigured: false,
  });

  useEffect(() => {
    const googleRequested = process.env.NEXT_PUBLIC_GOOGLE_AUTH === 'true';
    if (!googleRequested) {
      setConfig({ passwordAuthEnabled: true, googleOauthConfigured: false });
      return;
    }

    void fetch(`${API_URL}/api/v1/public/auth-config`, { credentials: 'include' })
      .then((res) => res.json())
      .then((body: { success?: boolean; data?: AuthConfig }) => {
        if (!body.success || !body.data) return;
        setConfig({
          passwordAuthEnabled: body.data.passwordAuthEnabled ?? true,
          googleOauthConfigured: Boolean(body.data.googleOauthConfigured),
        });
      })
      .catch(() => {
        setConfig({ passwordAuthEnabled: true, googleOauthConfigured: false });
      });
  }, []);

  return config;
}

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // Redirects to Google, then back to the frontend /dashboard on success.
      await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
    } catch {
      setError('Could not start Google sign-in');
      setLoading(false);
    }
  }, []);

  return { signInWithGoogle, googleLoading: loading, googleError: error };
}

interface AuthShellProps {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  const { theme, toggleTheme } = useTheme();
  const apiWarning =
    typeof window !== 'undefined' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas relative overflow-hidden cds-theme-transition">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--cds-accent-soft),_transparent_55%)]" />
      <div className="absolute top-4 right-4 z-10">
        <Button
          type="button"
          variant="ghost"
          className="!px-2.5 !py-1.5"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </Button>
      </div>
      <div className="w-full max-w-md relative">
        <div className="mb-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg text-sm font-bold mb-3">
            CDS
          </div>
          <h1 className="text-2xl font-semibold text-ink tracking-tight">Content Delivery System</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">{subtitle}</p>
        </div>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-ink mb-4">{title}</h2>
          {apiWarning && (
            <div className="mb-3">
              <Banner tone="error">
                Set NEXT_PUBLIC_API_URL on Vercel to your Render backend URL, then redeploy.
              </Banner>
            </div>
          )}
          {children}
        </Card>

        <div className="mt-5 text-center text-sm text-muted">{footer}</div>
      </div>
    </div>
  );
}

interface GoogleSignInButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}

export function GoogleSignInButton({ onClick, loading, label = 'Continue with Google' }: GoogleSignInButtonProps) {
  return (
    <Button type="button" variant="secondary" className="w-full" onClick={onClick} disabled={loading}>
      <GoogleIcon />
      {loading ? 'Redirecting…' : label}
    </Button>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-line" />
      <span className="text-xs text-muted">or</span>
      <div className="flex-1 border-t border-line" />
    </div>
  );
}

export function useOAuthErrorFromQuery() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    setError(code ? OAUTH_ERRORS[code] ?? 'Sign-in failed. Please try again.' : null);
  }, []);

  return error;
}

export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);
}

export function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  showConfirm,
}: {
  password: string;
  confirmPassword?: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange?: (value: string) => void;
  showConfirm?: boolean;
}) {
  return (
    <>
      <Field label="Password">
        <PasswordInput
          required
          minLength={8}
          autoComplete={showConfirm ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder={showConfirm ? 'At least 8 characters' : 'Your password'}
        />
      </Field>
      {showConfirm && onConfirmPasswordChange && (
        <Field label="Confirm password">
          <PasswordInput
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword ?? ''}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            placeholder="Repeat your password"
          />
        </Field>
      )}
    </>
  );
}

export function AuthFormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="mb-4">
      <Banner tone="error">{error}</Banner>
    </div>
  );
}

export function submitAuthForm(
  e: FormEvent,
  action: () => Promise<void>,
  setError: (msg: string | null) => void,
  setSubmitting: (v: boolean) => void,
) {
  e.preventDefault();
  setError(null);
  setSubmitting(true);
  void action()
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    })
    .finally(() => setSubmitting(false));
}

export function AuthPageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-accent font-medium underline underline-offset-2 hover:no-underline">
      {children}
    </Link>
  );
}
