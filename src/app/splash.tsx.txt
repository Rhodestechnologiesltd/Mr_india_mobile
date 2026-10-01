// src/app/splash.tsx â€” premium Mr India opening screen.
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getColors, useStore } from "../lib/mrindia";

// Load the local Mr India logo image.
const MR_INDIA_LOGO = require("../../assets/images/logos/Mr.india.jpeg");

export default function Splash() {
  // Provides navigation to the main application after loading.
  const router = useRouter();

  const { user, authReady } = useStore();
  const [splashDone, setSplashDone] = useState(false);
  // Create the active color palette and styles from the device color scheme.
  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);

  // Control the screen's fade, vertical movement, and progress animation.
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(20)).current;
  const progress = useRef(new Animated.Value(0)).current;

  // Start all splash-screen animations when the component mounts.
  useEffect(() => {
    Animated.parallel([
      // Fade the central content into view.
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      // Move the central content upward into its final position.
      Animated.timing(rise, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      // Fill the progress bar during the splash-screen delay.
      Animated.timing(progress, {
        toValue: 1,
        duration: 2300,
        useNativeDriver: false,
      }),
    ]).start();

    // Mark the splash animation as finished.
  const t = setTimeout(() => {
    setSplashDone(true);
  }, 2600);

  // Cancel the timer if the screen unmounts early.
  return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!splashDone || !authReady) {
      return;
    }

    if (user) {
      router.replace("/");
    } else {
      router.replace("/signin");
    }
  }, [splashDone, authReady, user, router]);
  // Convert progress from a numeric value into an animated percentage width.
  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.wrap}>
        {/* Decorative background layer covering the full screen. */}
        <View style={s.gridOverlay} />

        {/* Animated container holding the logo and loading information. */}
        <Animated.View
          style={[
            s.center,
            {
              opacity: fade,
              transform: [{ translateY: rise }],
            },
          ]}
        >
          {/* Branded logo card. */}
          <View style={s.logoCard}>
            <Image source={MR_INDIA_LOGO} style={s.logo} resizeMode="contain" />
          </View>

          <Text style={s.brand}>
            Mr <Text style={{ color: COLORS.amber }}>India</Text>
          </Text>

          <Text style={s.tagline}>PREMIUM INDIA SHOPPING</Text>

          {/* Animated loading-progress indicator. */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: barWidth }]} />
          </View>

          <Text style={s.loading}>Preparing your shopping journey...</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// Create theme-aware styles for the splash screen.
const makeStyles = (COLORS: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },

    wrap: {
      flex: 1,
      backgroundColor: COLORS.bg,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },

    gridOverlay: {
      ...StyleSheet.absoluteFill,
      opacity: COLORS.bg === "#131F2A" ? 0.06 : 0.35,
      backgroundColor: "transparent",
    },

    center: {
      width: "100%",
      alignItems: "center",
      paddingHorizontal: 34,
    },

    logoCard: {
      width: 230,
      height: 118,
      borderRadius: 28,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: COLORS.border,

      shadowColor: "#000",
      shadowOpacity: COLORS.bg === "#131F2A" ? 0.25 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },

    logo: {
      width: 190,
      height: 92,
    },

    brand: {
      color: COLORS.t1,
      fontSize: 30,
      fontWeight: "900",
      marginTop: 26,
      letterSpacing: -0.7,
    },

    tagline: {
      color: COLORS.amber,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 4,
      marginTop: 18,
      textAlign: "center",
    },

    progressTrack: {
      width: "72%",
      height: 4,
      borderRadius: 999,
      backgroundColor:
        COLORS.bg === "#131F2A"
          ? "rgba(255,255,255,0.12)"
          : "rgba(225,108,0,0.15)",
      marginTop: 34,
      overflow: "hidden",
    },

    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: COLORS.amber,
    },

    loading: {
      color: COLORS.t3,
      fontSize: 13,
      marginTop: 24,
      fontWeight: "700",
      textAlign: "center",
    },
  });

