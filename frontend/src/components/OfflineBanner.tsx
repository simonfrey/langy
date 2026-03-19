interface Props {
  blocking?: boolean;
  message?: string;
}

export default function OfflineBanner({ blocking, message }: Props) {
  return (
    <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${
      blocking
        ? 'bg-amber-50 border border-amber-200 text-amber-700'
        : 'bg-warm-100 border border-warm-200 text-warm-500'
    }`}>
      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
      {message ?? (blocking
        ? 'You are offline. This feature requires an internet connection.'
        : 'You are offline. Showing cached data.')}
    </div>
  );
}
