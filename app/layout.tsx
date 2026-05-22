import type { Metadata } from 'next';
import AppNavbar from '@/app/components/nav/AppNavbar';
import '@/styles/globals.scss';

export const metadata: Metadata = {
  title: 'Doc-u-maker',
  description: 'Simple Next.js + MongoDB auth starter'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}
