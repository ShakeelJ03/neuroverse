import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/shell/Sidebar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-jb' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display-sg' });
const serif = Fraunces({ subsets: ['latin'], variable: '--font-serif-fr', style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: 'Neuroverse — brain anatomy & imaging lab',
  description:
    'Interactive 3D neuroanatomy, neurological disease and medical-imaging simulation laboratory (educational).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${display.variable} ${serif.variable}`}>
      <body className="font-sans">
        <div className="flex h-[100dvh] w-screen flex-col overflow-hidden lg:flex-row">
          <Sidebar />
          <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
