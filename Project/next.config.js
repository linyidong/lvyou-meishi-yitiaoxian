/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // 项目 Logo（S05 /logo.svg）是自有静态资源，Next 默认拒绝对 SVG 做图片优化会 400，
    // 这里显式放行；同时用 attachment 降低 SVG 被当作脚本执行的风险。
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
  },
};

module.exports = nextConfig;
