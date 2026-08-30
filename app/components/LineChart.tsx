// Shared SVG line-chart renderer — originally lived inside admin/MetricGraph.tsx,
// pulled out so the per-metric tracker trend view (TrackerMetricTrendModal)
// can reuse the exact same rendering instead of a second implementation.
export type Point = { date: string; value: number };

// Picks ~4-5 "nice" round tick values spanning the data range (the classic
// 1/2/5-per-decade step algorithm) rather than just splitting min..max
// evenly, so the y-axis reads 20/40/60/80 instead of 22/44/66/88.
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const rawStep = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

// Short "Aug 17"-style label for an x-axis tick — dates are stored as
// plain YYYY-MM-DD strings, so pin the time to noon local rather than
// midnight UTC to dodge any timezone rollover onto the wrong day.
function formatXLabel(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Evenly spaced point indices for x-axis ticks — first, last, and a few
// in between — rather than one per point, since a month/all-time range can
// have far more points than fit legibly along the bottom.
function xTickIndices(pointCount: number, maxTicks = 5) {
  if (pointCount <= 1) return pointCount === 1 ? [0] : [];
  const count = Math.min(maxTicks, pointCount);
  const indices = Array.from({ length: count }, (_, i) => Math.round((i * (pointCount - 1)) / (count - 1)));
  return [...new Set(indices)];
}

// yRange fixes the axis to a known bounded scale (e.g. [0, 10] for a /10
// rating) instead of auto-fitting to whatever the data happens to span —
// without it, a metric that's consistently rated 8-10 renders as a
// dramatic-looking sawtooth when the real story is "always near the top".
//
// `sparkline` strips every axis/gridline/label and thins the line/fill down
// to a soft, low-contrast shape — for spots (the client Home carousel) that
// show the average and trend as their own text instead of reading exact
// values off the chart, so the chart's only job is "shape of the trend".
//
// `bleed` is the Home Dark trend panel's full-bleed treatment: the area
// fades from the line down to transparent (an SVG gradient, not a flat
// low-opacity fill) and the line itself runs edge to edge with no padding
// at all — the panel's own absolutely-positioned text overlay is drawn by
// the caller (TrendCarousel), not this component. gradientId must be
// unique per chart on the page since it's referenced via url(#id).
export function LineChart({
  points,
  yRange,
  sparkline,
  bleed,
  gradientId,
}: {
  points: Point[];
  yRange?: [number, number];
  sparkline?: boolean;
  bleed?: boolean;
  gradientId?: string;
}) {
  if (bleed) {
    const width = 720;
    const height = 200;
    const pad = 8;
    const values = points.map((p) => p.value);
    const lo = values.length > 0 ? Math.min(...values) : 0;
    const hi = values.length > 0 ? Math.max(...values) : 1;
    const span = hi - lo || 1;
    const yFor = (v: number) => pad + (height - pad * 2) - ((v - lo) / span) * (height - pad * 2);
    const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
    const coords = points.map((p, i) => ({ x: pad + i * stepX, y: yFor(p.value) }));
    const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
    const last = coords[coords.length - 1];
    const areaPath = coords.length > 0 ? `${linePath} L ${last.x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z` : "";
    const id = gradientId ?? "chart-grad";
    return (
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="line-chart-bleed" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fp-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--fp-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill={`url(#${id})`} />}
        <path d={linePath} fill="none" stroke="var(--fp-accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  const width = 720;
  const height = 240;
  const paddingTop = sparkline ? 10 : 20;
  const paddingBottom = sparkline ? 10 : 44;
  const paddingRight = sparkline ? 6 : 32;
  const paddingLeft = sparkline ? 6 : 52;
  const plotHeight = height - paddingTop - paddingBottom;
  const axisY = height - paddingBottom;

  const values = points.map((p) => p.value);
  const dataMax = values.length > 0 ? Math.max(...values) : 1;
  const dataMin = values.length > 0 ? Math.min(...values) : 0;

  const ticks = yRange ? niceTicks(yRange[0], yRange[1]) : niceTicks(dataMin, dataMax);
  const axisMin = yRange ? yRange[0] : Math.min(...ticks, dataMin);
  const axisMax = yRange ? yRange[1] : Math.max(...ticks, dataMax);
  const span = axisMax - axisMin || 1;

  const yFor = (v: number) => paddingTop + plotHeight - ((v - axisMin) / span) * plotHeight;

  const stepX = points.length > 1 ? (width - paddingLeft - paddingRight) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = paddingLeft + i * stepX;
    const y = yFor(p.value);
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${axisY} L ${coords[0].x} ${axisY} Z`;
  const xTicks = xTickIndices(coords.length);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`line-chart${sparkline ? " line-chart-sparkline" : ""}`}
      role="img"
      aria-label="Trend chart"
    >
      {!sparkline &&
        ticks.map((t) => (
          <g key={t}>
            <line
              x1={paddingLeft}
              y1={yFor(t)}
              x2={width - paddingRight}
              y2={yFor(t)}
              className="chart-gridline"
            />
            <text x={paddingLeft - 10} y={yFor(t)} className="chart-ylabel" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
      {!sparkline && <line x1={paddingLeft} y1={axisY} x2={width - paddingRight} y2={axisY} className="chart-axis" />}
      <path d={areaPath} className="chart-area" />
      <path d={linePath} className="chart-line" />
      {!sparkline &&
        coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 2.5} className="chart-dot" />
        ))}
      {!sparkline &&
        xTicks.map((i) => (
          <text key={i} x={coords[i].x} y={axisY + 18} className="chart-xlabel" textAnchor="middle">
            {formatXLabel(coords[i].date)}
          </text>
        ))}
      {!sparkline && coords.length > 0 && (
        <text x={coords[coords.length - 1].x} y={coords[coords.length - 1].y - 10} className="chart-endpoint-label">
          {Math.round(coords[coords.length - 1].value)}
        </text>
      )}
    </svg>
  );
}
