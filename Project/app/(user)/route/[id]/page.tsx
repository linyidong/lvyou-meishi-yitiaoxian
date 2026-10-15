import { PageHeader } from '@/components/common/PageHeader';

export default function RouteDetailPage({ params }: { params: { id: string } }) {
  return (
    <PageHeader
      title="U09 路线结果"
      description={`骨架占位：路线 ${params.id}，待阶段⑥实现（按天展示 + 地图 + 距离时间）。`}
    />
  );
}
