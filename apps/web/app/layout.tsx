import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { AppFooter } from '@/components/app-footer';
import './globals.css';
export const metadata: Metadata = { title:{ default:'Cívica', template:'%s — Cívica' }, description:'Perfis de senadores e deputados federais com dados oficiais, contexto, período e origem verificável.' };
export default function RootLayout({ children }: Readonly<{ children:ReactNode }>) {
  return <html lang="pt-BR"><body>
    <a href="#conteudo" className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground focus:translate-y-0">Pular para o conteúdo</a>
    <AppHeader />
    {children}
    <AppFooter />
  </body></html>;
}

