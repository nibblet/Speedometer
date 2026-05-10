import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';

type Props = {
  speed: number;
  size?: number;
};

export function DigitalReadout({ speed, size = 220 }: Props) {
  const display = Math.round(speed).toString();
  return (
    <View style={styles.wrap}>
      <Text
        style={[
          styles.number,
          { fontSize: size, lineHeight: size * 1.0 },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {display}
      </Text>
      <Text style={styles.unit}>MI / HR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  number: {
    color: colors.white,
    fontFamily: fonts.display,
    letterSpacing: -4,
    textShadowColor: colors.forgeOrangeGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  unit: {
    marginTop: 8,
    color: colors.forgeOrange,
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: 6,
  },
});
