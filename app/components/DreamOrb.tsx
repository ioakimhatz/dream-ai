// app/components/DreamOrb.tsx - Using Canva-exported PNG
import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface DreamOrbProps {
  state: OrbState;
}

export function DreamOrb({ state }: DreamOrbProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    switch (state) {
      case 'idle':
        // Still - no animation
        scale.value = withTiming(1.0, { duration: 300, easing: Easing.inOut(Easing.ease) });
        break;

      case 'listening':
        // Expand to 1.2x when user is speaking
        scale.value = withTiming(1.2, { duration: 300, easing: Easing.out(Easing.ease) });
        break;

      case 'thinking':
        // Pulse while processing
        scale.value = withRepeat(
          withSequence(
            withTiming(1.05, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.95, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        );
        break;

      case 'speaking':
        // Gentle pulse while AI speaks
        scale.value = withRepeat(
          withSequence(
            withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        );
        break;
    }
  }, [state]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle as any]}>
      <Image
        source={require('../../assets/images/orb.png')}
        style={styles.orb}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 500,
    height: 700,
    resizeMode: 'contain',
  },
});
