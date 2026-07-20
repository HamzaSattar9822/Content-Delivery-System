'use client';

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

function cx(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-accent text-accent-fg border-accent hover:opacity-90 shadow-sm',
    secondary: 'bg-surface text-ink border-line hover:bg-subtle',
    danger: 'bg-danger-soft text-danger border-danger/30 hover:opacity-90',
    ghost: 'bg-transparent text-muted border-transparent hover:bg-subtle hover:text-ink',
  };
  return <button className={cx(base, variants[variant], className)} {...props} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('border border-line rounded-xl bg-surface shadow-panel', className)}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5">
      <div>
        <h3 className="text-sm font-semibold text-ink tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted font-medium">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'w-full border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted bg-elevated focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        'w-full border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted bg-elevated focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-elevated focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1.5 leading-relaxed">{hint}</span>}
    </label>
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'muted' | 'outline' | 'success' | 'danger';
}) {
  const tones: Record<string, string> = {
    default: 'border-accent/30 bg-accent-soft text-accent',
    muted: 'border-line bg-subtle text-muted',
    outline: 'border-line bg-transparent text-ink',
    success: 'border-accent/30 bg-accent-soft text-accent',
    danger: 'border-danger/30 bg-danger-soft text-danger',
  };
  return (
    <span className={cx('inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-md', tones[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted mt-1.5 leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-line rounded-xl bg-surface shadow-panel">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-subtle/80 text-left">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium text-muted whitespace-nowrap text-xs uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-line border-dashed rounded-xl p-10 text-center text-sm text-muted bg-subtle/40">
      {message}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted">
      <div className="h-5 w-5 rounded-full border-2 border-line border-t-accent animate-spin" />
      <span>{label ?? 'Loading...'}</span>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px] p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm transition-colors" aria-label="Close">
            Close
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return (
    <div
      className={cx(
        'border rounded-lg px-3 py-2.5 text-sm mb-4',
        tone === 'error'
          ? 'border-danger/30 text-danger bg-danger-soft'
          : 'border-line text-muted bg-subtle',
      )}
    >
      {children}
    </div>
  );
}

export { cx };
