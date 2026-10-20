import { BUSINESS } from '@/config/business';
import { ENV } from '@/config/env';
import { MESSAGES } from '@/config/messages';

/**
 * 管理员外发提醒（新会员订单到账 / 用户自助重置密码）
 *
 * 场景 1（会员订单）：管理员在个人收款码模式下无法自动获知到账（个人收款码没有到账回调接口），
 * 因此在用户提交付款订单的第一时间把消息推到管理员手机上，
 * 管理员收到即可上线核对收款流水并核销。
 *
 * 场景 2（密码重置）：忘记密码走「凭注册邮箱直接设新密码」（自建库没有 SMTP），
 * 每次重置都推一条提醒给管理员，便于发现账号被他人恶意重置后及时人工纠正。
 *
 * 通道是可插拔的，目前有两条，可同时开启、互不影响：
 * 1. 「企业微信群机器人」→ 消息进企业微信群（ENV.ORDER_NOTIFY_WECOM_WEBHOOK）
 * 2. 「企业微信自建应用消息 + 微信插件」→ 消息可送达成员的个人微信
 *    （需 ENV.WECOM_CORP_ID / WECOM_APP_SECRET / WECOM_AGENT_ID 三项齐全）
 *
 * 未配置任何通道时整体静默跳过；发送失败只记日志、绝不抛出，站内红色角标不受影响。
 */

export interface NewOrderNotice {
  orderId: string;
  /** 下单用户邮箱 */
  email: string;
  /** 套餐展示名（如「月卡」） */
  planLabel: string;
  /** 金额（元，已格式化） */
  amountYuan: string;
  /** 付款通道展示名（如「微信支付」） */
  channelLabel: string;
  /** 付款备注（用户填写的转账备注 / 交易单号），可能为空 */
  payNote: string | null;
  /** 已格式化的提交时间（服务端本地时间 YYYY-MM-DD HH:mm） */
  createdAt: string;
}

const N = MESSAGES.ORDER_NOTIFY;

/** 拼企业微信群机器人 markdown 正文 */
function buildMarkdown(notice: NewOrderNotice): string {
  return [
    `**${N.title}**`,
    N.lineUser(notice.email),
    N.linePlan(notice.planLabel, notice.amountYuan),
    N.lineChannel(notice.channelLabel),
    notice.payNote ? N.lineNote(notice.payNote) : N.lineNoteEmpty,
    N.lineTime(notice.createdAt),
    N.lineOrder(notice.orderId),
    N.footer,
  ].join('\n');
}

/** 拼企业微信自建应用正文（text 类型；微信插件端只渲染纯文本，故不加 markdown 记号） */
function buildText(notice: NewOrderNotice): string {
  return [
    N.title,
    N.lineUser(notice.email),
    N.linePlan(notice.planLabel, notice.amountYuan),
    N.lineChannel(notice.channelLabel),
    notice.payNote ? N.lineNote(notice.payNote) : N.lineNoteEmpty,
    N.lineTime(notice.createdAt),
    N.lineOrder(notice.orderId),
    N.footer,
  ].join('\n');
}

/**
 * 通道 1 · 企业微信群机器人：POST { msgtype:'markdown', markdown:{ content } }。
 */
async function sendWecomGroupRobot(content: string): Promise<void> {
  const url = ENV.ORDER_NOTIFY_WECOM_WEBHOOK;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'markdown', markdown: { content } }),
      signal: AbortSignal.timeout(BUSINESS.ORDER_NOTIFY_TIMEOUT_MS),
    });
    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (!res.ok || (data.errcode ?? 0) !== 0) {
      console.warn(N.errSendFailed, res.status, data.errcode, data.errmsg);
    }
  } catch (error) {
    console.warn(N.errSendFailed, error);
  }
}

/** 应用 access_token 的进程内缓存（有效期 7200s，提前 5 分钟刷新，避免频繁调 gettoken 触发限流） */
let appTokenCache: { token: string; expiresAtMs: number } | null = null;

async function getWecomAppToken(): Promise<string | null> {
  const now = Date.now();
  const marginMs = BUSINESS.WECOM_APP_TOKEN_REFRESH_MARGIN_SECONDS * 1000;
  if (appTokenCache && appTokenCache.expiresAtMs - marginMs > now) return appTokenCache.token;

  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${ENV.WECOM_CORP_ID}&corpsecret=${ENV.WECOM_APP_SECRET}`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(BUSINESS.ORDER_NOTIFY_TIMEOUT_MS),
    });
    const data = (await res.json()) as {
      errcode?: number;
      errmsg?: string;
      access_token?: string;
      expires_in?: number;
    };
    if (!res.ok || (data.errcode ?? 0) !== 0 || !data.access_token) {
      console.warn(N.errTokenFailed, res.status, data.errcode, data.errmsg);
      return null;
    }
    appTokenCache = {
      token: data.access_token,
      expiresAtMs: now + (data.expires_in ?? 7200) * 1000,
    };
    return appTokenCache.token;
  } catch (error) {
    console.warn(N.errTokenFailed, error);
    return null;
  }
}

/**
 * 通道 2 · 企业微信自建应用消息：消息可通过「微信插件」送达成员的个人微信。
 * 接收人默认 @all（覆盖应用可见范围内的全部成员；单人企业即管理员本人）。
 */
async function sendWecomApp(content: string): Promise<void> {
  const token = await getWecomAppToken();
  if (!token) return;

  try {
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: ENV.WECOM_APP_TOUSER || '@all',
          msgtype: 'text',
          agentid: Number(ENV.WECOM_AGENT_ID),
          text: { content },
          safe: 0,
        }),
        signal: AbortSignal.timeout(BUSINESS.ORDER_NOTIFY_TIMEOUT_MS),
      },
    );
    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (!res.ok || (data.errcode ?? 0) !== 0) {
      console.warn(N.errAppSendFailed, res.status, data.errcode, data.errmsg);
    }
  } catch (error) {
    console.warn(N.errAppSendFailed, error);
  }
}

/**
 * 并行投递到所有已启用的通道：无任何通道时静默返回，任一通道失败不影响其余。
 * @param markdown 群机器人用（支持 markdown 记号）
 * @param plain 应用消息用（微信插件端只渲染纯文本，已去掉 markdown 记号）
 */
async function dispatch(markdown: string, plain: string): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (ENV.ORDER_NOTIFY_WECOM_WEBHOOK) tasks.push(sendWecomGroupRobot(markdown));
  if (ENV.WECOM_CORP_ID && ENV.WECOM_APP_SECRET && ENV.WECOM_AGENT_ID) {
    tasks.push(sendWecomApp(plain));
  }
  await Promise.all(tasks);
}

/** 新会员订单提醒总入口 */
export async function notifyNewMemberOrder(notice: NewOrderNotice): Promise<void> {
  await dispatch(buildMarkdown(notice), buildText(notice));
}

export interface PasswordResetNotice {
  /** 重置密码的账号邮箱 */
  email: string;
  /** 已格式化的重置时间（服务端本地时间 YYYY-MM-DD HH:mm） */
  at: string;
}

/** 密码重置提醒总入口：与订单提醒共用同一批通道 */
export async function notifyPasswordReset(notice: PasswordResetNotice): Promise<void> {
  const R = MESSAGES.RESET_PASSWORD;
  const lines = [R.notifyTitle, R.notifyLineUser(notice.email), R.notifyLineTime(notice.at), R.notifyFooter];
  await dispatch(lines.join('\n'), lines.map((l) => l.replace(/\*\*/g, '')).join('\n'));
}
