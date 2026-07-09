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
  const base = 'inline-flex items-center justify-center px-3 py-2 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed transition-none';
  const variants: Record<string, string> = {
    primary: 'bg-ink text-white border-ink hover:bg-black',
    secondary: 'bg-white text-ink border-line hover:bg-subtle',
    danger: 'bg-white text-ink border-line hover:bg-subtle',
    ghost: 'bg-transparent text-ink border-transparent hover:bg-subtle',
  };
  return <button className={cx(base, variants[variant], className)} {...props} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('border border-line rounded bg-white', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx('w-full border border-line rounded px-3 py-2 text-sm text-ink placeholder:text-muted bg-white', className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx('w-full border border-line rounded px-3 py-2 text-sm text-ink placeholder:text-muted bg-white', className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx('w-full border border-line rounded px-3 py-2 text-sm text-ink bg-white', className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'muted' | 'outline' }) {
  const tones: Record<string, string> = {
    default: 'border-ink text-ink',
    muted: 'border-line text-muted',
    outline: 'border-line text-ink',
  };
  return (
    <span className={cx('inline-flex items-center px-2 py-0.5 text-xs border rounded', tones[tone])}>{children}</span>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-line rounded">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-subtle text-left">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 font-medium text-muted whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="border border-line border-dashed rounded p-8 text-center text-sm text-muted">{message}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return <div className="text-sm text-muted py-8 text-center">{label ?? 'Loading...'}</div>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-line rounded" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm" aria-label="Close">
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
        'border rounded px-3 py-2 text-sm mb-4',
        tone === 'error' ? 'border-ink text-ink bg-subtle' : 'border-line text-muted bg-subtle',
      )}
    >
      {children}
    </div>
  );
}

export { cx };
