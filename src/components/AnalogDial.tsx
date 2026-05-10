import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
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
  const end = polar(cx, cy, r, END_ANGLE + 360);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
}

/** Short arc on the gauge circle between two needle angles (follows motion along the dial). */
function arcSegmentPath(
  cx: number,
  cy: number,
  radius: number,
  angleFrom: number,
  angleTo: number,
): string | null {
  let delta = angleTo - angleFrom;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  if (Math.abs(delta) < 0.08) return null;

  const p0 = polar(cx, cy, radius, angleFrom);
  const p1 = polar(cx, cy, radius, angleTo);
  const largeArc = Math.abs(delta) > 180 ? 1 : 0;
  const sweep = delta >= 0 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${p1.x} ${p1.y}`;
}

const TRAIL_MAX_SAMPLES = 36;
const NEEDLE_TIP_FR = 0.78;

export function AnalogDial({ size, speed, max = SPEED_MAX_MPH }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const tickOuter = r;
  const tickMajorInner = r - size * 0.06;
  const tickMinorInner = r - size * 0.03;
  const labelR = r - size * 0.13;

  const smoothSpeed = useRef(new Animated.Value(speed)).current;
  const [needleSpeed, setNeedleSpeed] = useState(speed);
  const [trailAngles, setTrailAngles] = useState<number[]>([]);
  const [motionGlow, setMotionGlow] = useState(0);

  useEffect(() => {
    const sub = smoothSpeed.addListener(({ value }) => setNeedleSpeed(value));
    return () => smoothSpeed.removeListener(sub);
  }, [smoothSpeed]);

  useEffect(() => {
    Animated.spring(smoothSpeed, {
      toValue: speed,
      useNativeDriver: false,
      friction: 9,
      tension: 48,
    }).start();
  }, [smoothSpeed, speed]);

  useEffect(() => {
    const ang = speedToAngle(needleSpeed, max);
    setTrailAngles((prev) => {
      const last = prev[prev.length - 1];
      if (last != null && Math.abs(ang - last) < 0.15) return prev;
      const next = [...prev, ang];
      if (next.length > TRAIL_MAX_SAMPLES) next.splice(0, next.length - TRAIL_MAX_SAMPLES);
      return next;
    });
  }, [needleSpeed, max]);

  useEffect(() => {
    const base = Math.min(1, (speed / max) * 0.55);
    const chase = Math.min(1, Math.abs(speed - needleSpeed) / 6);
    setMotionGlow(Math.min(1, base * 0.35 + chase * 0.85));
  }, [speed, needleSpeed, max]);

  const needleAngle = speedToAngle(needleSpeed, max);
  const needleTipR = r * NEEDLE_TIP_FR;
  const needleTip = polar(cx, cy, needleTipR, needleAngle);
  const needleTail = polar(cx, cy, r * 0.12, needleAngle + 180);

  const trailR = needleTipR;
  const trailSegments: { d: string; opacity: number; key: string }[] = [];
  if (trailAngles.length >= 2) {
    const n = trailAngles.length - 1;
    for (let i = 0; i < n; i++) {
      const d = arcSegmentPath(cx, cy, trailR, trailAngles[i], trailAngles[i + 1]);
      if (!d) continue;
      const along = (i + 1) / n;
      const opacity =
        (0.06 + along ** 1.15 * 0.52) * (0.65 + motionGlow * 0.35);
      trailSegments.push({ d, opacity, key: `at-${i}-${trailAngles[i].toFixed(1)}` });
    }
  }

  const majorValues: number[] = [];
  for (let v = 0; v <= max; v += 5) majorValues.push(v);
  const minorValues: number[] = [];
  for (let v = 0; v <= max; v += 1) {
    if (v % 5 !== 0) minorValues.push(v);
  }

  const glowWide = size * 0.045;
  const glowCore = size * 0.022;
  const glowAlpha = 0.14 + motionGlow * 0.55;
  const hubPulse = 1 + Math.min(0.06, motionGlow * 0.08);

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

        <Path
          d={arcPath(cx, cy, r)}
          stroke="url(#arcGrad)"
          strokeWidth={2}
          fill="none"
        />

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

        <G pointerEvents="none">
          {trailSegments.map(({ d, opacity, key }) => (
            <Path
              key={key}
              d={d}
              stroke={colors.forgeOrange}
              strokeOpacity={opacity}
              strokeWidth={size * 0.055}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {trailSegments.map(({ d, key }) => (
            <Path
              key={`${key}-core`}
              d={d}
              stroke={colors.forgeOrange}
              strokeOpacity={0.28}
              strokeWidth={size * 0.018}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </G>

        <G>
          <Line
            x1={needleTail.x}
            y1={needleTail.y}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={colors.forgeOrange}
            strokeOpacity={glowAlpha * 0.85}
            strokeWidth={glowWide}
            strokeLinecap="round"
          />
          <Line
            x1={needleTail.x}
            y1={needleTail.y}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={colors.forgeOrange}
            strokeOpacity={glowAlpha * 0.55}
            strokeWidth={glowCore * 2.2}
            strokeLinecap="round"
          />
          <Line
            x1={needleTail.x}
            y1={needleTail.y}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke="url(#needleGrad)"
            strokeWidth={size * 0.018}
            strokeLinecap="round"
          />
          <Circle cx={cx} cy={cy} r={size * 0.05 * hubPulse} fill={colors.forgeBlack} />
          <Circle
            cx={cx}
            cy={cy}
            r={size * 0.05 * hubPulse}
            fill="none"
            stroke={colors.forgeOrange}
            strokeOpacity={0.35 + motionGlow * 0.45}
            strokeWidth={2 + motionGlow * 2}
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
