import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface RingGaugeProps {
  size: number;
  strokeWidth?: number;
  progress: number; // 0-1
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}

// Circular progress ring used for the readiness score and nutrition-macro
// donuts -- one small SVG primitive instead of a charting library.
export function RingGauge({ size, strokeWidth = 8, progress, color, trackColor, children }: RingGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? 'rgba(255,255,255,0.08)'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}
