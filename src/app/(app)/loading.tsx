export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-52 animate-pulse rounded-2xl bg-muted/70" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-white/70 ring-1 ring-border" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-white/70 ring-1 ring-border" />
    </div>
  );
}
