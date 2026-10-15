import { PageHeader } from '@/components/common/PageHeader';
import { PRODUCT } from '@/config/product';

export default function HomePage() {
  return <PageHeader title={PRODUCT.NAME} description="U02 首页：骨架占位，待阶段⑥实现（Slogan、热门城市入口）。" />;
}
