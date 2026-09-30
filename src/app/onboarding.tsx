// src/app/onboarding.tsx — animated, swipeable how-it-works / guidance carousel.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getColors, GRAD } from "../lib/mrindia";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "compass",
    grad: ["#FF9E2C", "#FF5E3A"],
    title: "Shop India, from Mauritius",
    body: "Browse Amazon, Myntra, Flipkart, Nykaa and more — all inside one beautiful app.",
  },
  {
    icon: "bag-handle",
    grad: ["#2874F0", "#1B4FA8"],
    title: "One tap to add",
    body: "Found something you love? Tap “Shop via Mr India” and it drops into your cart instantly.",
  },
  {
    icon: "shield-checkmark",
    grad: ["#00CCB0", "#0A8F7C"],
    title: "We buy & verify",
    body: "Our India team purchases your items and can verify each one before it ships (+MUR 200/product).",
  },
  {
    icon: "airplane",
    grad: ["#FF3F6C", "#C72C53"],
    title: "Delivered to your door",
    body: "Express (MUR 400/product, ~7 days) or Standard (MUR 300/product, ~2 weeks). You pay Mr India — simple.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [idx, setIdx] = useState(0);
  const ref = useRef<ScrollView>(null);

  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);

  const next = () => {
    if (idx < SLIDES.length - 1) {
      ref.current?.scrollTo({ x: (idx + 1) * width, animated: true });
    } else {
      router.replace("/");
    }
  };

  return (
    <SafeAreaView style={s.wrap} edges={["top", "left", "right"]}>
      <View style={s.topActions}>
        {idx > 0 ? (
          <TouchableOpacity
            style={s.topBtn}
            onPress={() =>
              ref.current?.scrollTo({ x: (idx - 1) * width, animated: true })
            }
          >
            <Text style={s.topBtnTxt}>‹ Previous</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.topBtnPlaceholder} />
        )}

        <TouchableOpacity style={s.topBtn} onPress={() => router.replace("/")}>
          <Text style={s.topBtnTxt}>Skip</Text>
        </TouchableOpacity>
      </View>
      <Animated.ScrollView
        ref={ref as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) =>
          setIdx(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        scrollEventThrottle={16}
      >
        {SLIDES.map((sl, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.7, 1, 0.7],
            extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });
          return (
            <View key={i} style={[s.slide, { width }]}>
              <Animated.View style={{ transform: [{ scale }], opacity }}>
                <LinearGradient colors={sl.grad as any} style={s.iconWrap}>
                  <Ionicons name={sl.icon as any} size={64} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <Text style={s.title}>{sl.title}</Text>
              <Text style={s.body}>{sl.body}</Text>
            </View>
          );
        })}
      </Animated.ScrollView>
      <View style={s.dots}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const w = scrollX.interpolate({
            inputRange,
            outputRange: [8, 26, 8],
            extrapolate: "clamp",
          });
          const o = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });
          return (
            <Animated.View key={i} style={[s.dot, { width: w, opacity: o }]} />
          );
        })}
      </View>
      <View style={s.footer}>
        <TouchableOpacity onPress={next} activeOpacity={0.9}>
          <LinearGradient
            colors={GRAD}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.cta}
          >
            <Text style={s.ctaTxt}>
              {idx === SLIDES.length - 1 ? "Start Shopping" : "Next"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Create theme-aware styles for the onboarding carousel.
const makeStyles = (COLORS: any) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: COLORS.bg },
    slide: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
      paddingTop: 60,
    },
    iconWrap: {
      width: 150,
      height: 150,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 44,
      shadowColor: "#000",
      shadowOpacity: COLORS.bg === "#131F2A" ? 0.25 : 0.1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    title: {
      color: COLORS.t1,
      fontSize: 26,
      fontWeight: "800",
      textAlign: "center",
      letterSpacing: -0.5,
    },
    body: {
      color: COLORS.t2,
      fontSize: 15,
      lineHeight: 24,
      textAlign: "center",
      marginTop: 16,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      marginBottom: 10,
    },
    dot: { height: 8, borderRadius: 4, backgroundColor: COLORS.amber },
    footer: { padding: 24, paddingBottom: 40 },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 18,
      paddingVertical: 17,
      shadowColor: COLORS.amber,
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    ctaTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },

    topActions: {
      position: "absolute",
      top: 42,
      left: 20,
      right: 20,
      zIndex: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    topBtn: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },

    topBtnPlaceholder: {
      width: 90,
    },

    topBtnTxt: {
      color: COLORS.t2,
      fontWeight: "800",
      fontSize: 14,
    },
  });
