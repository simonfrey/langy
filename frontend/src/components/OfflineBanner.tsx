interface Props {
  blocking?: boolean;
  message?: string;
}

export default function OfflineBanner({ blocking, message }: Props) {
  return (
    <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
      blocking
        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
        : 'bg-slate-800 border border-slate-700 text-slate-400'
    }`}>
      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
      {message ?? (blocking
        ? 'You are offline. This feature requires an internet connection.'
        : 'You are offline. Showing cached data.')}
    </div>
  );
}
