import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { fonts } from '@/theme';
import { useAppearance } from '@/context/AppearanceContext';

type Props = {
  speed: number;
  /** Width reserved for the speed numerals (full span for centered layout). */
  containerWidth: number;
  /** Upper bound for digit size (pt). */
  fontSizeMax: number;
};

export function DigitalReadout({ speed, containerWidth, fontSizeMax }: Props) {
  const { palette } = useAppearance();
  const display = Math.round(speed).toString();
  const fontSize = Math.min(fontSizeMax, containerWidth * 0.44);

  return (
    <View style={[styles.wrap, { width: containerWidth }]}>
      <Text
        style={[
          styles.number,
          {
            color: palette.white,
            textShadowColor: palette.forgeOrangeGlow,
            fontSize,
            lineHeight: fontSize * (Platform.OS === 'ios' ? 1.05 : 1.1),
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.35}
      >
        {display}
      </Text>
      <Text style={[styles.unit, { color: palette.forgeOrange }]}>MI / HR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  number: {
    fontFamily: fonts.display,
    letterSpacing: -4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
    width: '100%',
    textAlign: 'center',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  unit: {
    marginTop: 8,
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 6,
    textAlign: 'center',
    width: '100%',
  },
});
