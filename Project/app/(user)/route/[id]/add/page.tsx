import { PageHeader } from '@/components/common/PageHeader';

export default function RouteAddPage({ params }: { params: { id: string } }) {
  return (
    <PageHeader
      title="U06 添加地点"
      description={`骨架占位：路线 ${params.id}，待阶段⑥实现（链接/文案导入 + AI 提取）。`}
    />
  );
}
