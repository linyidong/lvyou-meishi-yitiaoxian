import { PageHeader } from '@/components/common/PageHeader';

export default function RoutePlacesPage({ params }: { params: { id: string } }) {
  return (
    <PageHeader
      title="U07 地点勾选"
      description={`骨架占位：路线 ${params.id}，待阶段⑥实现（勾选纳入路线的地点）。`}
    />
  );
}
