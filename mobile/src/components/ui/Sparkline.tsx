import React from 'react';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color: string;
  strokeWidth?: number;
  showDot?: boolean;
}

// Minimal, dependency-free trend line — deliberately not a full charting
// library per design-system.md's "one chart at a time, minimal axes" rule.
export function Sparkline({ values, width = 280, height = 64, color, strokeWidth = 2.5, showDot = true }: SparklineProps) {
  if (values.length < 2) {
    return (
      <Svg width={width} height={height}>
        <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth={1} strokeDasharray="4,4" opacity={0.3} />
      </Svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return { x, y };
  });
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const last = points[points.length - 1];

  return (
    <Svg width={width} height={height}>
      <Polyline points={pointsStr} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {showDot && <Circle cx={last.x} cy={last.y} r={4} fill={color} />}
    </Svg>
  );
}
