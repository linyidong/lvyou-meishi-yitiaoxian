import { PageHeader } from '@/components/common/PageHeader';

export default function RouteEditPage({ params }: { params: { id: string } }) {
  return (
    <PageHeader
      title="U08 路线编辑"
      description={`骨架占位：路线 ${params.id}，待阶段⑥实现（按天上移/下移调整顺序）。`}
    />
  );
}
