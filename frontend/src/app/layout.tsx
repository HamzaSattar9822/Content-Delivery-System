import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-cds',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Content Delivery System',
  description: 'Secure content distribution, access control and analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cds-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var m=t==='dark'||(t!=='light'&&d);document.documentElement.classList.toggle('dark',m);}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
