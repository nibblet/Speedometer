import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { fonts } from '@/theme';
import { useAppearance } from '@/context/AppearanceContext';

type Props = {
  size: number;
  headingDeg: number; // 0-360, true bearing (N=0)
};

const CARDINALS: { label: string; angle: number; emphasis: boolean }[] = [
  { label: 'N', angle: 0, emphasis: true },
  { label: 'E', angle: 90, emphasis: false },
  { label: 'S', angle: 180, emphasis: false },
  { label: 'W', angle: 270, emphasis: false },
];

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function CompassRose({ size, headingDeg }: Props) {
  const { palette: colors } = useAppearance();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // The rose rotates opposite to heading so North points up to current bearing.
  const rotation = -headingDeg;

  // Tick marks every 30°
  const ticks: number[] = [];
  for (let a = 0; a < 360; a += 30) ticks.push(a);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Outer ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={colors.slateBorder}
          strokeWidth={1}
          fill={colors.forgeBlack}
        />

        <G originX={cx} originY={cy} rotation={rotation}>
          {/* tick ring */}
          {ticks.map((a) => {
            const outer = polar(cx, cy, r - 2, a);
            const inner = polar(cx, cy, r - (a % 90 === 0 ? 10 : 6), a);
            return (
              <Line
                key={`tick-${a}`}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke={a % 90 === 0 ? colors.bone : colors.dimmer}
                strokeWidth={a % 90 === 0 ? 1.5 : 1}
              />
            );
          })}

          {/* North arrow */}
          <Polygon
            points={`${cx},${cy - r * 0.55} ${cx - size * 0.04},${cy} ${cx + size * 0.04},${cy}`}
            fill={colors.danger}
          />
          <Polygon
            points={`${cx},${cy + r * 0.55} ${cx - size * 0.04},${cy} ${cx + size * 0.04},${cy}`}
            fill={colors.bone}
          />

          {/* Cardinal labels */}
          {CARDINALS.map((c) => {
            const p = polar(cx, cy, r - 18, c.angle);
            return (
              <SvgText
                key={c.label}
                x={p.x}
                y={p.y + 5}
                fill={c.emphasis ? colors.danger : colors.bone}
                fontSize={size * 0.13}
                fontFamily={fonts.display}
                textAnchor="middle"
              >
                {c.label}
              </SvgText>
            );
          })}
        </G>

        {/* Fixed "you are here" arrow at top of rose */}
        <Polygon
          points={`${cx},${cy - r - 2} ${cx - 5},${cy - r + 6} ${cx + 5},${cy - r + 6}`}
          fill={colors.forgeOrange}
        />
        <Circle cx={cx} cy={cy} r={3} fill={colors.forgeOrange} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
