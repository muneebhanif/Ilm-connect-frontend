import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = '100%', height = 12, borderRadius = 10, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  const baseColor = useThemeColor({}, 'icon');

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const blockStyle = useMemo(
    () => [
      {
        width,
        height,
        borderRadius,
        backgroundColor: baseColor,
        opacity: pulse,
      },
      style,
    ],
    [width, height, borderRadius, baseColor, pulse, style]
  );

  return <Animated.View style={blockStyle as any} />;
}

type SkeletonScreenProps = {
  padding?: number;
  rows?: number;
};

export function SkeletonScreen({ padding = 16, rows = 6 }: SkeletonScreenProps) {
  const bg = useThemeColor({}, 'background');

  return (
    <View style={[styles.screen, { backgroundColor: bg, paddingHorizontal: padding, paddingTop: padding }]}>
      <Skeleton height={28} width={220} borderRadius={14} style={{ marginBottom: 14 }} />
      <Skeleton height={16} width={160} borderRadius={10} style={{ marginBottom: 24 }} />

      {Array.from({ length: rows }).map((_, idx) => (
        <View key={idx} style={styles.row}>
          <Skeleton height={18} width={'70%'} borderRadius={10} />
          <Skeleton height={18} width={'35%'} borderRadius={10} style={{ marginTop: 10 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  row: {
    marginBottom: 18,
  },
});
