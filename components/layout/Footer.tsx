import { PRODUCT } from '@/config/product';

/** 用户端页脚 */
export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
      <p>
        {PRODUCT.NAME} · {PRODUCT.SLOGAN}
      </p>
      {PRODUCT.CONTACT_EMAIL ? <p className="mt-1">联系邮箱：{PRODUCT.CONTACT_EMAIL}</p> : null}
      {PRODUCT.ICP_NUMBER ? <p className="mt-1">{PRODUCT.ICP_NUMBER}</p> : null}
    </footer>
  );
}
