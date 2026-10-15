import { PageHeader } from '@/components/common/PageHeader';
import { BUSINESS } from '@/config/business';

export default function ProfilePage() {
  return (
    <PageHeader
      title="U10 个人中心"
      description={`骨架占位：待阶段⑥实现（账号信息、付费按钮 ${BUSINESS.ENABLE_UPGRADE_BUTTON ? '开' : '关'}）。`}
    />
  );
}
