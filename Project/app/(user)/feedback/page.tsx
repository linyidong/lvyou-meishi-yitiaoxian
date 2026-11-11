import { FeedbackForm } from '@/components/feedback/FeedbackForm';

/** T-098 功能建议（需登录，middleware 已拦截） */
export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <FeedbackForm />
    </div>
  );
}
