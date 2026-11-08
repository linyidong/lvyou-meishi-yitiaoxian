/**
 * T-088：中国大陆手机号归一化。
 * 登录/注册共用：接受 11 位手机号（可带空格/短横线）或 +86 前缀，统一转为 E.164（+86...）。
 * 非手机号返回 null，由调用方回退到邮箱分支。
 */
export function normalizeChinaPhone(input: string): string | null {
  const s = (input ?? '').replace(/[\s-]/g, '');
  const m = s.match(/^(?:\+?86)?(1[3-9]\d{9})$/);
  return m ? `+86${m[1]}` : null;
}

/** 简单邮箱校验（与登录页一致，不追求 RFC 完备） */
export function isEmailLike(input: string): boolean {
  return /^\S+@\S+\.\S+$/.test((input ?? '').trim());
}
