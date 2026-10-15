import type { Metadata } from 'next';
import { PRODUCT } from '@/config/product';
import './globals.css';

export const metadata: Metadata = {
  title: PRODUCT.NAME,
  description: PRODUCT.DESCRIPTION,
  icons: { icon: PRODUCT.FAVICON_PATH },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
