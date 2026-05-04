import type { Metadata } from 'next';
import './globals.css';
import InsufficientCreditsModal from '@/components/InsufficientCreditsModal';
import { LanguageProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Qasynda Marketing Studio',
  description: 'AI-powered product image generation for Wildberries, Ozon, and Kaspi.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <LanguageProvider>
          {children}
          <InsufficientCreditsModal />
        </LanguageProvider>
      </body>
    </html>
  );
}
