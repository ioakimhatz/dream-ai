// app/components/DreamOrb.tsx - Advanced physics-based animations
import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface DreamOrbProps {
  state: OrbState;
  audioLevel?: number; // ✅ NEW: 0-1 scale of current audio volume
}

export function DreamOrb({ state, audioLevel = 0 }: DreamOrbProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Cancel any ongoing animations before starting new ones
    cancelAnimation(scale);
    cancelAnimation(opacity);

    switch (state) {
      case 'idle':
        // Slow, gentle breathing - feels alive but calm
        scale.value = withSpring(1.0, {
          damping: 12,       // ✅ SMOOTHER
          stiffness: 90,     // ✅ GENTLER
        });
        opacity.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),    // ✅ SLOWER, SIN easing
            withTiming(0.88, { duration: 2500, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true // Reverse for smooth breathing
        );
        break;

      case 'listening':
        // ✅ AUDIO-REACTIVE: Scale based on voice volume
        // Base scale: 1.15, expands up to 1.35 based on audio level
        const reactiveScale = 1.15 + (audioLevel * 0.2); // 1.15-1.35

        scale.value = withSpring(reactiveScale, {
          damping: 8,        // ✅ ADJUSTED: Less damping = more bouncy
          stiffness: 120,    // ✅ ADJUSTED: More stiffness = faster response
          mass: 0.8,         // ✅ ADJUSTED: Less mass = more reactive
        });

        // Active breathing - faster and more pronounced
        opacity.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),     // ✅ FASTER
            withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) })    // ✅ FASTER
          ),
          -1,
          true
        );
        break;

      case 'thinking':
        // ✅ GENTLE, slow pulsing (no audio input for this state)
        scale.value = withRepeat(
          withSequence(
            withSpring(1.05, {
              damping: 18,      // ✅ SLOWER
              stiffness: 60,    // ✅ GENTLER
              mass: 1.2
            }),
            withSpring(0.98, {
              damping: 18,
              stiffness: 60,
              mass: 1.2
            })
          ),
          -1,
          false
        );

        // Slow breathing
        opacity.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.85, { duration: 1500, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
        break;

      case 'speaking':
        // ✅ Will use audio levels from realistic speech simulation
        // Responsive but smooth for AI voice
        const aiVoiceScale = 1.0 + (audioLevel * 0.15); // 1.0-1.15

        scale.value = withSpring(aiVoiceScale, {
          damping: 12,       // ✅ RESPONSIVE but smooth
          stiffness: 100,    // ✅ Medium response
          mass: 1.0,         // ✅ Balanced
        });

        // Gentle breathing
        opacity.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.9, { duration: 1200, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
        break;
    }
  }, [state]);

  // ✅ NEW: React to audio level changes in real-time
  useEffect(() => {
    // ✅ SKIP audio reactivity for thinking state
    if (state === 'thinking') {
      return; // Let thinking animation run independently
    }

    if (audioLevel !== undefined) {
      if (state === 'listening') {
        // User speaking - larger, more responsive
        const reactiveScale = 1.15 + (audioLevel * 0.2);
        scale.value = withSpring(reactiveScale, {
          damping: 8,
          stiffness: 120,
          mass: 0.8,
        });
      } else if (state === 'speaking') {
        // AI speaking - responsive to simulated speech pattern
        const aiVoiceScale = 1.0 + (audioLevel * 0.15);
        scale.value = withSpring(aiVoiceScale, {
          damping: 12,
          stiffness: 100,
          mass: 1.0,
        });
      }
    }
  }, [audioLevel, state]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
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
