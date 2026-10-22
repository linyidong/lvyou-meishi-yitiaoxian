#!/usr/bin/env node
/**
 * 移动端体验审计（真机尺寸模拟，需 dev server 在跑）。
 *
 * 检查：
 *   ① 横向溢出：document.scrollWidth > innerWidth
 *   ② 小字号：正文/辅助文字 10–11px 的出现次数（徽章类不计入判定，仅统计）
 *   ③ 小触控目标：可点元素宽或高 < 40px
 *   ④ 地图容器高度
 *
 * 用法：cd Project && npm run audit:mobile
 * 输出：终端摘要 + /tmp/mobile-audit/*.png 截图
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const PAGES = [
  ['/', '首页'],
  ['/city', '选择城市'],
  ['/try/new?city=%E8%A5%BF%E5%AE%89', '游客·设置路线'],
  ['/try/pick', '游客·挑选地点'],
  ['/try/result', '游客·结果页'],
  ['/login', '登录'],
];
const DEVICES = [
  ['iPhone 16 Pro', 402, 874],
  ['Redmi K80', 412, 915],
];
const OUT = '/tmp/mobile-audit';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let problems = 0;

for (const [dname, w, h] of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  for (const [path, label] of PAGES) {
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const smallText = [];
        const smallTap = [];
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const fs = parseFloat(cs.fontSize);
          const text = (el.textContent || '').trim();
          if (fs < 12 && text && el.children.length === 0 && cs.display !== 'none') {
            smallText.push({ fs, text: text.slice(0, 12) });
          }
          if (['button', 'a'].includes(el.tagName.toLowerCase()) && (r.width < 40 || r.height < 40)) {
            smallTap.push({ tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height), text: text.slice(0, 10) });
          }
        }
        const mapEl = document.querySelector('.amap-container')?.parentElement;
        return {
          scrollWidth: de.scrollWidth,
          innerWidth: window.innerWidth,
          smallTextCount: smallText.length,
          smallTextSample: smallText.slice(0, 3),
          smallTapCount: smallTap.length,
          smallTapSample: smallTap.slice(0, 3),
          mapHeight: mapEl ? Math.round(mapEl.getBoundingClientRect().height) : null,
        };
      });

      const overflow = m.scrollWidth > m.innerWidth + 1;
      if (overflow) problems++;
      const flags = [
        overflow ? `❌ 横向溢出 ${m.scrollWidth}>${m.innerWidth}` : '✅ 无溢出',
        m.smallTextCount ? `⚠️ 小字号 ${m.smallTextCount}` : '✅ 无小字号',
        m.smallTapCount ? `⚠️ 小按钮 ${m.smallTapCount}` : '✅ 按钮达标',
        m.mapHeight ? `地图高 ${m.mapHeight}px` : '',
      ].filter(Boolean);
      console.log(`${dname} | ${label.padEnd(8)} | ${flags.join(' | ')}`);
      if (m.smallTextSample.length) console.log('     小字号示例:', JSON.stringify(m.smallTextSample));
      if (m.smallTapSample.length) console.log('     小按钮示例:', JSON.stringify(m.smallTapSample));
      await page.screenshot({ path: `${OUT}/${dname.replace(/\s/g, '')}-${label}.png` });
    } catch (e) {
      console.log(`${dname} | ${label} | ❌ 访问失败: ${e.message.slice(0, 80)}`);
      problems++;
    }
  }
  await ctx.close();
}

/* ===== 真实流程测量（带草稿状态）=====
   静态页面在"空状态"下往往不暴露溢出；游客三步走完才会渲染列表/地图。
   这里用真实交互走一遍：/try/new?city=西安 → 选出发城市 → /try/pick 勾 3 个 → /try/result。
   判定口径用 visualViewport.width（可视宽）而不是 innerWidth：
   内容超宽时移动端浏览器会把 innerWidth 放大并整体缩小页面——这正是"字变小、要放大"的根因。 */
for (const [dname, w, h] of DEVICES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/try/new?city=${encodeURIComponent('西安')}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('#originGrid button').first().click();
    await page.locator('button', { hasText: /下一步/ }).first().click();
    await page.waitForURL(/\/try\/pick/, { timeout: 30000 });
    await page.waitForTimeout(2000);

    const pick = await page.evaluate(() => ({
      innerW: window.innerWidth,
      visualW: Math.round(window.visualViewport?.width ?? 0),
      scrollW: document.documentElement.scrollWidth,
    }));
    const pickBad = pick.visualW > 0 && (pick.innerW > pick.visualW + 1 || pick.scrollW > pick.visualW + 1);
    if (pickBad) problems++;
    console.log(`${dname} | 流程·挑选地点(有草稿) | ${pickBad ? `❌ 被撑宽 innerW=${pick.innerW} visualW=${pick.visualW} scrollW=${pick.scrollW}` : `✅ 宽度正常 ${pick.visualW}`}`);
    await page.screenshot({ path: `${OUT}/${dname.replace(/\s/g, '')}-流程-挑选地点.png` });

    const boxes = page.locator('input[type=checkbox]');
    for (let i = 0; i < Math.min(3, await boxes.count()); i++) await boxes.nth(i).check();
    await page.locator('button', { hasText: /生成路线/ }).first().click();
    await page.waitForURL(/\/try\/result/, { timeout: 90000 });
    await page.waitForSelector('.amap-container', { timeout: 90000 });
    await page.waitForTimeout(2500);

    const res = await page.evaluate(() => {
      const vv = window.visualViewport;
      const el = document.querySelector('.amap-container')?.parentElement;
      return {
        innerW: window.innerWidth,
        visualW: Math.round(vv?.width ?? 0),
        mapH: Math.round(el?.getBoundingClientRect().height ?? 0),
        vh: Math.round(vv?.height ?? 0),
      };
    });
    const resBad = res.visualW > 0 && res.innerW > res.visualW + 1;
    const mapRatio = res.vh ? Math.round((res.mapH / res.vh) * 100) : 0;
    if (resBad || mapRatio < 40) problems++;
    console.log(`${dname} | 流程·结果页(含地图) | ${resBad ? '❌ 被撑宽' : '✅ 宽度正常'} | 地图 ${res.mapH}px = 视口 ${mapRatio}%`);
    await page.screenshot({ path: `${OUT}/${dname.replace(/\s/g, '')}-流程-结果页.png` });
  } catch (e) {
    console.log(`${dname} | 流程测量失败: ${e.message.slice(0, 90)}`);
    problems++;
  }
  await ctx.close();
}

await browser.close();
console.log(`\n截图目录：${OUT}`);
console.log(problems === 0 ? '横向溢出 0 处。' : `横向溢出 ${problems} 处需要修。`);
process.exit(problems === 0 ? 0 : 1);
