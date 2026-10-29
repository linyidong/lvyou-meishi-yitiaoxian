#!/usr/bin/env node
/**
 * 简历用「脱敏截图」抓取（2026-10-29）
 *
 * 目的：给 _resume 的一页 case / 作品集提供界面证据，**不含隐私**：
 *   - 邮箱 / 手机号 / UUID / 内网 IP / 主机名 → 文本替换为占位符
 *   - 收款码图片 → 打码
 *   - 长图里的二维码 → 模糊
 *   - 不抓后台「技术栈」页（按用户要求屏蔽）
 *
 * 用法（需 dev server 在 3000、Supabase 可达、Project/.env.test.local 有账号）：
 *   node scripts/capture-resume-shots.mjs [输出目录]
 * 默认输出：/Volumes/Programming/Project-File/_resume/截图/06-旅行美食一条线
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const OUT = process.argv[2] || '/Volumes/Programming/Project-File/_resume/截图/06-旅行美食一条线';
const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:3000';
const ROUTE_ID = process.env.SHOT_ROUTE || '39553174-5405-4849-a592-1a8b17870a22';
const SHARE_TOKEN = process.env.SHOT_TOKEN || 'wmz4kPGnXESO';
const ROOT = path.resolve(import.meta.dirname, '..');

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const cred = loadEnv(path.join(ROOT, '.env.test.local'));

/** 页面内脱敏：文本替换 + 收款码打码 */
const REDACT = () => {
  const email = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
  const phone = /\b1[3-9]\d{9}\b/g;
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const host = /192\.168\.\d{1,3}\.\d{1,3}(:\d+)?|desktop-[a-z0-9]+|127\.0\.0\.1(:\d+)?|localhost(:\d+)?/gi;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) {
    const t = node.nodeValue;
    if (!t) continue;
    const nt = t
      .replace(email, 'user@example.com')
      .replace(phone, '138****0000')
      .replace(uuid, '••••••••-••••-••••')
      .replace(host, 'demo-host')
      .replace(/sk-[•\w-]{2,}/g, 'sk-••••（已脱敏）');
    if (nt !== t) node.nodeValue = nt;
  }
  // 分享 token 输入框：整体打码（token 等于访问凭证）
  for (const el of document.querySelectorAll('input, textarea')) {
    if (/token/i.test(el.getAttribute('aria-label') || el.placeholder || '') || /^[A-Za-z0-9_-]{10,}$/.test(el.value || '')) {
      el.style.filter = 'blur(7px)';
    }
  }
  // API Key 输入框（含"已保存：sk-••••"占位）：整体打码
  for (const el of document.querySelectorAll('input, textarea')) {
    const hint = `${el.value || ''} ${el.placeholder || ''}`;
    if (/sk-|已保存：/.test(hint)) el.style.filter = 'blur(7px)';
  }
  // 收款码等敏感图片：直接打码
  for (const img of document.querySelectorAll('img')) {
    if (/pay-qr|qrcode|qr-/i.test(img.getAttribute('src') || '')) {
      img.style.filter = 'blur(12px)';
    }
  }
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    acceptDownloads: true,
    locale: 'zh-CN',
  });
  const page = await ctx.newPage();

  const shoot = async (name, { fullPage = false, clip } = {}) => {
    await page.evaluate(REDACT);
    await page.waitForTimeout(300);
    const file = path.join(OUT, name);
    await page.screenshot({ path: file, fullPage, ...(clip ? { clip } : {}) });
    console.log('  ✓', name);
  };

  // 登录
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.fill('input[type=email]', cred.TEST_EMAIL);
  await page.fill('input[type=password]', cred.TEST_PASSWORD);
  await page.locator('button[type=submit]').first().click();
  await page.waitForTimeout(5000);
  console.log('登录完成:', page.url());

  // 1. 首页
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await shoot('20261029-旅行-首页.png');

  // 2. 结果页（地图 + 列表）
  await page.goto(`${BASE}/route/${ROUTE_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  await shoot('20261029-旅行-结果页地图与列表.png');

  // 3. AI 提取面板
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const summary = page.locator('summary').first();
  if (await summary.count()) {
    await summary.click();
    await page.waitForTimeout(800);
  }
  await shoot('20261029-旅行-AI提取面板.png');

  // 4. 图片识别 tab
  const imgTab = page.locator('button', { hasText: '图片识别' }).first();
  if (await imgTab.count()) {
    await imgTab.click();
    await page.waitForTimeout(700);
  }
  await shoot('20261029-旅行-图片识别.png');

  // 5. 分享导入预览
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('button', { hasText: '导入分享路线' }).first().click();
  await page.waitForTimeout(1000);
  // 所有交互都限定在弹窗内（页面上还有同名但隐藏的导入面板 tab）
  const dialog = page.locator('[role=dialog]').first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  const linkTab = dialog.locator('button', { hasText: '粘贴链接' }).first();
  if (await linkTab.count()) await linkTab.click();
  await page.waitForTimeout(300);
  const tokenInput = dialog.locator('input[type=text], textarea').first();
  if (await tokenInput.count()) await tokenInput.fill(SHARE_TOKEN);
  const previewBtn = dialog.locator('button', { hasText: /查看路线预览/ }).first();
  if (await previewBtn.count()) {
    await previewBtn.click();
    await page.waitForTimeout(3000);
  }
  const box = await dialog.boundingBox();
  await shoot('20261029-旅行-分享导入预览.png', box ? { clip: box } : {});

  // 6. 后台设置页（Key 本身已是掩码，再统一脱敏主机名/邮箱）
  await page.goto(`${BASE}/admin/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await shoot('20261029-旅行-后台设置.png');

  // 7. 后台概览（用量）
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await shoot('20261029-旅行-后台概览.png');

  // 8. 长图（导出后把二维码区域模糊）
  await page.goto(`${BASE}/route/${ROUTE_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const exportBtn = page.locator('button', { hasText: /导出长图|导出/ }).first();
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 40000 }),
      exportBtn.click(),
    ]);
    const rawPath = path.join(OUT, '_poster-raw.png');
    await dl.saveAs(rawPath);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    const blurred = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // 二维码在长图左下角（比例区域），整块模糊
      // 用「已脱敏」色块盖住二维码与域名区域（不依赖检测，确保不漏）
      const w = img.width;
      const h0 = img.height;
      const bx = 0;
      const by = Math.round(h0 - 520);
      const bw = Math.round(w * 0.8);
      const bh = Math.round(340);
      ctx.save();
      ctx.fillStyle = '#FAFAF9';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#E7E5E4';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      ctx.fillStyle = '#A8A29E';
      ctx.font = '500 30px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('二维码 / 域名已脱敏', bx + 36, by + bh / 2);
      ctx.restore();
      return c.toDataURL('image/png');
    }, b64);
    fs.writeFileSync(path.join(OUT, '20261029-旅行-长图.png'), Buffer.from(blurred.split(',')[1], 'base64'));
    fs.unlinkSync(rawPath);
    console.log('  ✓ 20261029-旅行-长图.png（二维码已模糊）');
  } catch (e) {
    console.log('  ! 长图导出失败:', e.message.slice(0, 80));
  }

  await browser.close();
  console.log('\n输出目录:', OUT);
}

main().catch((e) => {
  console.error('抓取失败:', e.message);
  process.exit(1);
});
