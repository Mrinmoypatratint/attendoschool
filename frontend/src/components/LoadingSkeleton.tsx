export function Skeleton({ width = '100%', height = '20px', radius = '8px', className = '' }: {
  width?: string; height?: string; radius?: string; className?: string;
}) {
  return <div className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><Skeleton width="80%" height="12px" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><Skeleton width={`${60 + Math.random() * 30}%`} height="14px" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stats">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat" key={i}>
          <Skeleton width="60%" height="12px" />
          <div style={{ marginTop: 12 }}>
            <Skeleton width="40%" height="28px" />
          </div>
        </div>
      ))}
    </div>
  );
}
