import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { colors, fonts, SPEED_MAX_MPH } from '@/theme';

type Props = {
  size: number;
  speed: number;
  max?: number;
};

// 270° sweep, 0 mph at lower-left (225° clockwise from top), max at lower-right (135°)
const START_ANGLE = 225;
const END_ANGLE = 135;
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, angleClockwiseFromTop: number) {
  const a = ((angleClockwiseFromTop - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function speedToAngle(speed: number, max: number) {
  const clamped = Math.max(0, Math.min(max, speed));
  return START_ANGLE + (clamped / max) * SWEEP;
}

function arcPath(cx: number, cy: number, r: number) {
  const start = polar(cx, cy, r, START_ANGLE);
  // End just before END_ANGLE for visual gap
  const end = polar(cx, cy, r, END_ANGLE + 360);
  // Going clockwise visually — sweep-flag = 1 in SVG, large-arc-flag = 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
}

export function AnalogDial({ size, speed, max = SPEED_MAX_MPH }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const tickOuter = r;
  const tickMajorInner = r - size * 0.06;
  const tickMinorInner = r - size * 0.03;
  const labelR = r - size * 0.13;

  // Major ticks every 5 mph, minor every 1 mph
  const majorValues: number[] = [];
  for (let v = 0; v <= max; v += 5) majorValues.push(v);
  const minorValues: number[] = [];
  for (let v = 0; v <= max; v += 1) {
    if (v % 5 !== 0) minorValues.push(v);
  }

  const needleAngle = speedToAngle(speed, max);
  const needleTip = polar(cx, cy, r * 0.78, needleAngle);
  const needleTail = polar(cx, cy, r * 0.12, needleAngle + 180);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.slateBorder} />
            <Stop offset="1" stopColor={colors.slate} />
          </LinearGradient>
          <LinearGradient id="needleGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.forgeOrange} />
            <Stop offset="1" stopColor={colors.forgeOrangeDim} />
          </LinearGradient>
        </Defs>

        {/* Background arc */}
        <Path
          d={arcPath(cx, cy, r)}
          stroke="url(#arcGrad)"
          strokeWidth={2}
          fill="none"
        />

        {/* Minor ticks */}
        {minorValues.map((v) => {
          const angle = speedToAngle(v, max);
          const outer = polar(cx, cy, tickOuter, angle);
          const inner = polar(cx, cy, tickMinorInner, angle);
          return (
            <Line
              key={`min-${v}`}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={colors.dimmer}
              strokeWidth={1}
            />
          );
        })}

        {/* Major ticks */}
        {majorValues.map((v) => {
          const angle = speedToAngle(v, max);
          const outer = polar(cx, cy, tickOuter, angle);
          const inner = polar(cx, cy, tickMajorInner, angle);
          return (
            <Line
              key={`maj-${v}`}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={colors.forgeOrange}
              strokeWidth={2.5}
            />
          );
        })}

        {/* Number labels */}
        {majorValues.map((v) => {
          const angle = speedToAngle(v, max);
          const p = polar(cx, cy, labelR, angle);
          return (
            <SvgText
              key={`lbl-${v}`}
              x={p.x}
              y={p.y + size * 0.018}
              fill={colors.white}
              fontSize={size * 0.06}
              fontFamily={fonts.bold}
              textAnchor="middle"
            >
              {v}
            </SvgText>
          );
        })}

        {/* Needle */}
        <G>
          <Line
            x1={needleTail.x}
            y1={needleTail.y}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke="url(#needleGrad)"
            strokeWidth={size * 0.018}
            strokeLinecap="round"
          />
          <Circle cx={cx} cy={cy} r={size * 0.05} fill={colors.forgeBlack} />
          <Circle
            cx={cx}
            cy={cy}
            r={size * 0.05}
            fill="none"
            stroke={colors.forgeOrange}
            strokeWidth={2}
          />
          <Circle cx={cx} cy={cy} r={size * 0.018} fill={colors.forgeOrange} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
