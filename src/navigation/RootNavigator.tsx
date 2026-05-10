import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import Svg, { Circle, Path } from 'react-native-svg';
import { fonts, type ThemePalette } from '@/theme';
import { useAppearance } from '@/context/AppearanceContext';
import SpeedometerScreen from '@/screens/SpeedometerScreen';
import MapScreen from '@/screens/MapScreen';
import HistoryScreen from '@/screens/HistoryScreen';

const Tab = createBottomTabNavigator();

function TabIcon({
  name,
  active,
  palette,
}: {
  name: string;
  active: boolean;
  palette: ThemePalette;
}) {
  const stroke = active ? palette.forgeOrange : palette.dim;
  if (name === 'Speedometer') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={1.8} fill="none" />
        <Path
          d="M12 12 L 16 7"
          stroke={active ? palette.forgeOrange : palette.bone}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Circle cx={12} cy={12} r={1.5} fill={stroke} />
      </Svg>
    );
  }
  if (name === 'Map') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path
          d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"
          stroke={stroke}
          strokeWidth={1.8}
          fill="none"
          strokeLinejoin="round"
        />
        <Path d="M9 4 L9 18" stroke={stroke} strokeWidth={1.8} />
        <Path d="M15 6 L15 20" stroke={stroke} strokeWidth={1.8} />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={1.8} fill="none" />
      <Path
        d="M12 7 V12 L15.5 14"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function createTabStyles(palette: ThemePalette) {
  return StyleSheet.create({
    tabSafe: { backgroundColor: palette.forgeBlack },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: palette.slate,
      borderTopWidth: 1,
      borderTopColor: palette.slateBorder,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 8,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      borderRadius: 12,
    },
    tabItemActive: {
      backgroundColor: palette.forgeOrangeGlow,
    },
    tabLabel: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 2,
      marginTop: 4,
    },
    tabLabelActive: { color: palette.forgeOrange },
  });
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { palette } = useAppearance();
  const styles = useMemo(() => createTabStyles(palette), [palette]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.tabSafe}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = (descriptors[route.key].options.title as string) ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[styles.tabItem, focused && styles.tabItemActive]}
            >
              <TabIcon name={route.name} active={focused} palette={palette} />
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export function RootNavigator() {
  const { palette } = useAppearance();

  const navTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: palette.forgeBlack,
        card: palette.forgeBlack,
        border: palette.slateBorder,
        primary: palette.forgeOrange,
      },
    }),
    [palette],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen
          name="Speedometer"
          component={SpeedometerScreen}
          options={{ title: 'SPEED' }}
        />
        <Tab.Screen name="Map" component={MapScreen} options={{ title: 'MAP' }} />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: 'HISTORY' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
