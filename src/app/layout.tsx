import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SSH Web Terminal',
  description: 'Connect to a host via SSH in your browser',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">{children}</body>
    </html>
  );
}
