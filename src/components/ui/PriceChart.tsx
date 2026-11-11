import React from 'react';

export interface PriceChartDataPoint {
  date: Date;
  value: number;
}

interface PriceChartProps {
  dataPoints: PriceChartDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showAxisLabels?: boolean;
  className?: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  dataPoints,
  width = 300,
  height = 120,
  color = 'var(--accent)',
  showAxisLabels = true,
  className = '',
}) => {
  const gradientId = React.useId();

  if (!dataPoints || dataPoints.length < 2) {
    return (
      <div
        className={`chart-container w-full rounded-xl border border-border bg-surface flex items-center justify-center ${className}`}
        style={{ aspectRatio: `${width}/${height}` }}
      >
        <span className="text-muted text-xs">No price history yet</span>
      </div>
    );
  }

  const sorted = [...dataPoints].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const dates = sorted.map((d) => d.date.getTime());
  const values = sorted.map((d) => d.value);

  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const padding = {
    top: 16,
    right: 16,
    bottom: showAxisLabels ? 24 : 12,
    left: showAxisLabels ? 44 : 12,
  };

  const innerWidth = Math.max(width - padding.left - padding.right, 1);
  const innerHeight = Math.max(height - padding.top - padding.bottom, 1);

  const getX = (date: Date) => {
    if (maxDate === minDate) return padding.left + innerWidth / 2;
    return (
      padding.left +
      ((date.getTime() - minDate) / (maxDate - minDate)) * innerWidth
    );
  };

  const getY = (value: number) => {
    if (maxValue === minValue) return padding.top + innerHeight / 2;
    return (
      padding.top +
      innerHeight -
      ((value - minValue) / (maxValue - minValue)) * innerHeight
    );
  };

  const points = sorted.map((d) => ({ x: getX(d.date), y: getY(d.value) }));

  const linePath = `M ${points
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' L ')}`;

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(
    2
  )},${(height - padding.bottom).toFixed(2)} L ${points[0].x.toFixed(
    2
  )},${(height - padding.bottom).toFixed(2)} Z`;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

  const formatValue = (value: number) =>
    `£${Math.round(value).toLocaleString()}`;

  return (
    <div
      className={`chart-container w-full rounded-xl border border-border bg-surface ${className}`}
      style={{ aspectRatio: `${width}/${height}` }}
    >
      <svg
        role="img"
        aria-label="Price history chart"
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>Price history</title>
        <defs>
          <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={color}
              stopOpacity="0.18"
            />
            <stop
              offset="100%"
              stopColor={color}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {showAxisLabels && (
          <g className="chart-axis">
            <text
              x={padding.left - 8}
              y={padding.top + 4}
              textAnchor="end"
              className="fill-muted"
            >
              {formatValue(maxValue)}
            </text>
            <text
              x={padding.left - 8}
              y={height - padding.bottom - 4}
              textAnchor="end"
              className="fill-muted"
            >
              {formatValue(minValue)}
            </text>
            <text
              x={points[0].x}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted"
            >
              {formatDate(sorted[0].date)}
            </text>
            <text
              x={points[points.length - 1].x}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted"
            >
              {formatDate(sorted[sorted.length - 1].date)}
            </text>
          </g>
        )}

        <path
          d={areaPath}
          fill={`url(#${gradientId}-area)`}
        />

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="var(--bg)"
            stroke={color}
            strokeWidth={1.5}
          />
        ))}
      </svg>
    </div>
  );
};
