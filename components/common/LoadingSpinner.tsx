export function LoadingSpinner({ label = '加载中' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
