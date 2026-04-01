'use client';

interface YIndicators {
  x1: number;
  x2: number;
  x3: number;
  x4: number;
  x5: number;
  x6: number;
  x7: number;
  x8: number;
}

interface YRadarChartProps {
  indicators: YIndicators;
  indicatorsRaw?: YIndicators;
}

const AXES = [
  { key: 'x1' as const, label: '純支払利息比率', min: -0.3, max: 5.1 },
  { key: 'x2' as const, label: '負債回転期間', min: 0.9, max: 18.0 },
  { key: 'x3' as const, label: '総資本売上総利益率', min: 6.5, max: 63.6 },
  { key: 'x4' as const, label: '売上高経常利益率', min: -8.5, max: 5.1 },
  { key: 'x5' as const, label: '自己資本対固定資産比率', min: -76.5, max: 350.0 },
  { key: 'x6' as const, label: '自己資本比率', min: -68.6, max: 68.5 },
  { key: 'x7' as const, label: '営業CF', min: -10.0, max: 15.0 },
  { key: 'x8' as const, label: '利益剰余金', min: -3.0, max: 100.0 },
] as const;

const CENTER_X = 200;
const CENTER_Y = 200;
const RADIUS = 150;
const NUM_AXES = 8;

function normalize(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}

function getEvaluation(ratio: number): { label: string; color: string; bgColor: string } {
  if (ratio >= 0.75) return { label: '優良', color: '#16a34a', bgColor: '#f0fdf4' };
  if (ratio >= 0.5) return { label: '良好', color: '#2563eb', bgColor: '#eff6ff' };
  if (ratio >= 0.25) return { label: '普通', color: '#ca8a04', bgColor: '#fefce8' };
  return { label: '要改善', color: '#dc2626', bgColor: '#fef2f2' };
}

function polarToCartesian(ratio: number, axisIndex: number): { x: number; y: number } {
  const angle = (2 * Math.PI * axisIndex) / NUM_AXES - Math.PI / 2;
  const r = ratio * RADIUS;
  return {
    x: CENTER_X + r * Math.cos(angle),
    y: CENTER_Y + r * Math.sin(angle),
  };
}

function buildPolygonPoints(ratios: number[]): string {
  return ratios
    .map((r, i) => {
      const { x, y } = polarToCartesian(r, i);
      return `${x},${y}`;
    })
    .join(' ');
}

export function YRadarChart({ indicators, indicatorsRaw }: YRadarChartProps) {
  const normalized = AXES.map((axis) => normalize(indicators[axis.key], axis.min, axis.max));

  const referencelevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="w-full">
      {/* Radar Chart */}
      <div className="w-full max-w-lg mx-auto">
        <svg viewBox="0 0 400 400" className="w-full h-auto">
          {/* Reference polygons */}
          {referencelevels.map((level) => (
            <polygon
              key={level}
              points={buildPolygonPoints(Array(NUM_AXES).fill(level))}
              fill="none"
              stroke="#d1d5db"
              strokeWidth="0.5"
            />
          ))}

          {/* Axis lines */}
          {AXES.map((_, i) => {
            const { x, y } = polarToCartesian(1, i);
            return (
              <line
                key={`axis-${i}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={x}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Data polygon */}
          <polygon
            points={buildPolygonPoints(normalized)}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="#3b82f6"
            strokeWidth="2"
          />

          {/* Data points */}
          {normalized.map((r, i) => {
            const { x, y } = polarToCartesian(r, i);
            return (
              <circle
                key={`dot-${i}`}
                cx={x}
                cy={y}
                r="4"
                fill="#3b82f6"
                stroke="#fff"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Axis labels */}
          {AXES.map((axis, i) => {
            const { x, y } = polarToCartesian(1.22, i);
            const rawValue = indicatorsRaw ? indicatorsRaw[axis.key] : indicators[axis.key];
            const displayValue =
              typeof rawValue === 'number' ? rawValue.toFixed(1) : String(rawValue);
            return (
              <g key={`label-${i}`}>
                <text
                  x={x}
                  y={y - 6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#374151"
                >
                  {axis.label}
                </text>
                <text
                  x={x}
                  y={y + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill="#6b7280"
                >
                  {displayValue}
                </text>
              </g>
            );
          })}

          {/* Reference level labels */}
          {referencelevels.map((level) => {
            const { y } = polarToCartesian(level, 0);
            return (
              <text
                key={`ref-${level}`}
                x={CENTER_X + 4}
                y={y - 2}
                fontSize="8"
                fill="#9ca3af"
              >
                {Math.round(level * 100)}%
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend / Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-semibold text-gray-700">指標</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">値</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">範囲</th>
              <th className="text-center py-2 px-3 font-semibold text-gray-700">評価</th>
            </tr>
          </thead>
          <tbody>
            {AXES.map((axis, i) => {
              const ratio = normalized[i];
              const evaluation = getEvaluation(ratio);
              const rawValue = indicatorsRaw ? indicatorsRaw[axis.key] : indicators[axis.key];
              const displayValue =
                typeof rawValue === 'number' ? rawValue.toFixed(1) : String(rawValue);
              return (
                <tr key={axis.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-800 font-medium">{axis.label}</td>
                  <td className="py-2 px-3 text-right text-gray-700 tabular-nums">
                    {displayValue}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-500 text-xs">
                    {axis.min} ~ {axis.max}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        color: evaluation.color,
                        backgroundColor: evaluation.bgColor,
                      }}
                    >
                      {evaluation.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
