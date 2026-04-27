type ChartPoint = {
  label: string;
  value: number;
  note?: string;
};

type AdvancedDashboardChartProps = {
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryPoints: ChartPoint[];
  secondaryPoints: ChartPoint[];
  primaryFormatter?: (value: number) => string;
  secondaryFormatter?: (value: number) => string;
};

function normalizePoints(points: ChartPoint[]) {
  return points.map((point, index) => ({
    ...point,
    key: point.note ?? `${point.label}-${index}`,
  }));
}

function buildPath(values: number[], maxValue: number) {
  if (values.length === 0) {
    return "";
  }

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 94 - (value / maxValue) * 82;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function AdvancedDashboardChart({
  title,
  description,
  primaryLabel,
  secondaryLabel,
  primaryPoints,
  secondaryPoints,
  primaryFormatter = (value) => String(value),
  secondaryFormatter = (value) => String(value),
}: AdvancedDashboardChartProps) {
  const primary = normalizePoints(primaryPoints);
  const secondary = normalizePoints(secondaryPoints);
  const primaryValues = primary.map((point) => point.value);
  const secondaryValues = secondary.map((point) => point.value);
  const maxPrimary = Math.max(...primaryValues, 1);
  const maxSecondary = Math.max(...secondaryValues, 1);
  const path = buildPath(secondaryValues, maxSecondary);
  const peakPrimary = Math.max(...primaryValues, 0);
  const peakSecondary = Math.max(...secondaryValues, 0);

  return (
    <article className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-gray-light">
            {description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-gray-light">
              Pico {primaryLabel}
            </p>
            <p className="mt-2 font-semibold text-white">
              {primaryFormatter(peakPrimary)}
            </p>
          </div>
          <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-gray-light">
              Media {secondaryLabel}
            </p>
            <p className="mt-2 font-semibold text-white">
              {secondaryFormatter(Math.round(average(secondaryValues)))}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_18rem]">
        <div className="overflow-hidden rounded-2xl border border-brand-gray-mid bg-brand-black/35 p-4">
          <div className="relative h-64">
            <svg
              viewBox="0 0 100 100"
              role="img"
              aria-label={`${title}: ${primaryLabel} e ${secondaryLabel}`}
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
            >
              {[20, 40, 60, 80].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="100"
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.4"
                />
              ))}
              {primary.map((point, index) => {
                const width = Math.max(5, 72 / Math.max(primary.length, 1));
                const gap = primary.length === 1 ? 0 : 24 / (primary.length - 1);
                const x = primary.length === 1 ? 47 : index * (width + gap);
                const height = Math.max(4, (point.value / maxPrimary) * 78);

                return (
                  <rect
                    key={point.key}
                    x={x}
                    y={94 - height}
                    width={width}
                    height={height}
                    rx="1.5"
                    fill="url(#primaryGradient)"
                  />
                );
              })}
              <path
                d={path}
                fill="none"
                stroke="#f5f5f5"
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
              />
              {secondary.map((point, index) => {
                const x = secondary.length === 1 ? 50 : (index / (secondary.length - 1)) * 100;
                const y = 94 - (point.value / maxSecondary) * 82;
                return (
                  <circle
                    key={point.key}
                    cx={x}
                    cy={y}
                    r="1.8"
                    fill="#e10600"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              <defs>
                <linearGradient id="primaryGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#e10600" />
                  <stop offset="100%" stopColor="#4b5563" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {primary.map((point, index) => (
              <div key={point.key} className="min-w-0 text-center">
                <p className="truncate text-xs font-semibold text-white">
                  {point.label}
                </p>
                <p className="mt-1 text-[11px] text-brand-gray-light">
                  {primaryFormatter(point.value)}
                </p>
                {secondary[index] ? (
                  <p className="text-[11px] text-brand-red">
                    {secondaryFormatter(secondary[index].value)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/35 p-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-brand-red" />
              <p className="text-sm font-semibold text-white">{primaryLabel}</p>
            </div>
            <p className="mt-2 text-xs text-brand-gray-light">
              {primaryFormatter(Math.round(average(primaryValues)))} em media
            </p>
          </div>
          <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/35 p-4">
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-6 rounded-full bg-white" />
              <p className="text-sm font-semibold text-white">{secondaryLabel}</p>
            </div>
            <p className="mt-2 text-xs text-brand-gray-light">
              {secondaryFormatter(Math.round(average(secondaryValues)))} em media
            </p>
          </div>
          <div className="rounded-2xl border border-brand-gray-mid bg-brand-black/35 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-gray-light">
              Pico {secondaryLabel}
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {secondaryFormatter(peakSecondary)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
