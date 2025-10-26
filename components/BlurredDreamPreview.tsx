import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

const DREAM_PURPLE = "#7278E6";

type Props = {
  onUnlock: () => void;
  prompt?: string;
  fallbackImageUri?: string;
};

/** Keyword → image mapping (expanded catalog with more keywords) */
function curiosityImageFromPrompt(prompt?: string): string | null {
  if (!prompt) return null;
  const p = (prompt || "").toLowerCase();
  
  const catalog: { test: RegExp; url: string }[] = [
    // Nature & Outdoors
    { test: /(park|forest|trees|grass|nature|woods)/i, url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&q=80" },
    { test: /(beach|ocean|sea|sand|coast|wave)/i, url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80" },
    { test: /(mountain|peak|ridge|alpine|summit)/i, url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80" },
    { test: /(lake|river|water|pond)/i, url: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1600&q=80" },
    { test: /(desert|dunes|sand|sahara)/i, url: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&q=80" },
    { test: /(sunset|sunrise|dawn|dusk)/i, url: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1600&q=80" },
    
    // Urban & City
    { test: /(city|street|buildings|skyline|downtown|urban)/i, url: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600&q=80" },
    { test: /(night|lights|neon|evening)/i, url: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1600&q=80" },
    
    // Indoor & Spaces
    { test: /(kitchen|home|apartment|room|house|interior)/i, url: "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?w=1600&q=80" },
    { test: /(office|desk|work|computer)/i, url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80" },
    
    // Space & Cosmic
    { test: /(space|galaxy|stars|planet|cosmos|universe)/i, url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1600&q=80" },
    { test: /(rocket|spacecraft|astronaut)/i, url: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1600&q=80" },
    
    // Transportation
    { test: /(car|drive|road|highway|vehicle)/i, url: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1600&q=80" },
    { test: /(plane|airplane|flight|airport)/i, url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1600&q=80" },
    { test: /(train|railway|railroad)/i, url: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=1600&q=80" },
    
    // Events & Emotions
    { test: /(romance|wedding|kiss|love)/i, url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80" },
    { test: /(party|celebration|dance|festival)/i, url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=80" },
    { test: /(sad|rain|storm|crying)/i, url: "https://images.unsplash.com/photo-1428908728789-d2de25dbd4e2?w=1600&q=80" },
    { test: /(happy|joy|smile|laughing)/i, url: "https://images.unsplash.com/photo-1534361960057-19889db9621e?w=1600&q=80" },
    
    // Fantasy & Abstract
    { test: /(dream|fantasy|magic|mystical)/i, url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1600&q=80" },
    { test: /(fire|flame|burning)/i, url: "https://images.unsplash.com/photo-1525183995014-bd94c0750cd5?w=1600&q=80" },
    { test: /(ice|snow|winter|cold|frozen)/i, url: "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1600&q=80" },
    
    // Animals
    { test: /(dog|puppy|canine)/i, url: "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=1600&q=80" },
    { test: /(cat|kitten|feline)/i, url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1600&q=80" },
    { test: /(bird|flying|wings)/i, url: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=1600&q=80" },
  ];
  
  for (const item of catalog) {
    if (item.test.test(p)) return item.url;
  }
  
  // Default fallback - dreamy clouds
  return "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=1600&q=80";
}

export function BlurredDreamPreview({ onUnlock, prompt, fallbackImageUri }: Props) {
  // pulse for CTA
  const pulse = useRef(new Animated.Value(1)).current;
  // fade/slide-in for the whole content block
  const fade = useRef(new Animated.Value(0)).current;
  const flyY = useRef(new Animated.Value(12)).current;
  // subtle shimmering ambiance
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Soft appear
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, delay: 120, useNativeDriver: true }),
      Animated.timing(flyY, { toValue: 0, duration: 280, delay: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  const curiosityUrl = useMemo(
    () => curiosityImageFromPrompt(prompt || "") || fallbackImageUri || "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=1600&q=80",
    [prompt, fallbackImageUri]
  );

  return (
    <View style={styles.container}>
      <Image source={{ uri: curiosityUrl }} style={styles.backgroundImage} />

      {/* Heavy iOS blur */}
      <BlurView intensity={120} style={styles.blurOverlay} tint="light">
        {/* Ambient shimmer layer */}
        <Animated.View
          style={[
            styles.shimmer,
            { opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] }) },
          ]}
        />

        {/* Subtle "radial" vignette (vertical + horizontal cross) */}
        <View pointerEvents="none" style={styles.vignetteWrap}>
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0)"]}
            style={styles.vignetteV}
          />
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0)"]}
            style={styles.vignetteH}
          />
        </View>

        {/* Centered content (fades & slides in) */}
        <Animated.View style={[styles.contentWrap, { opacity: fade, transform: [{ translateY: flyY }] }]}>
          <Text style={styles.h1}>Your Dream is Ready</Text>
          <Text style={styles.sub}>We turned your dream into reality.</Text>

          <Animated.View style={[styles.ctaWrap, { transform: [{ scale: pulse }] }]}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={async () => {
                // local haptic tap
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onUnlock();
              }}
              style={styles.unlockButton}
            >
              <LinearGradient
                colors={[DREAM_PURPLE, "#9B9FFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.unlockGradient}
              >
                <Text style={styles.unlockText}>Unlock My Dream 🔓</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: 220, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
  backgroundImage: { width: "100%", height: "100%", resizeMode: "cover" },
  blurOverlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 16 },

  shimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.06)" },

  // faux radial vignette
  vignetteWrap: { ...StyleSheet.absoluteFillObject },
  vignetteV: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  vignetteH: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },

  contentWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },

  h1: {
    color: "#FFFFFF",
    fontSize: 28,  // INCREASED from 22 to 28! 🎉
    lineHeight: 34,  // Adjusted line height
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  sub: {
    marginTop: 8,
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  ctaWrap: { marginTop: 24, width: "100%", alignItems: "center" },

  unlockButton: {
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: DREAM_PURPLE, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
    }),
  },
  unlockGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    borderRadius: 14,
    width: 260,
  },
  unlockText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
});