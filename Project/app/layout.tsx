import type { Metadata, Viewport } from 'next';
import { PRODUCT } from '@/config/product';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 让内容延伸到刘海/灵动岛与底部横条区域，再由各处的 safe-area padding 兜住
  viewportFit: 'cover',
};

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
