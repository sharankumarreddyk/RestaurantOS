export function Skeleton({ className = '', width, height }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, minHeight: height || '1em' }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 space-y-3">
      <Skeleton className="w-full" height="140px" />
      <Skeleton width="70%" height="1.2em" />
      <Skeleton width="40%" height="1em" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg">
          <Skeleton width="40px" height="40px" className="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height="1em" />
            <Skeleton width="30%" height="0.8em" />
          </div>
        </div>
      ))}
    </div>
  );
}
