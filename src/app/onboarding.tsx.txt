// src/app/onboarding.tsx
// Animated, swipeable Mr India onboarding carousel using GIF demonstrations.

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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

/* -------------------------------------------------------------------------- */
/*                                   SLIDES                                   */
/* -------------------------------------------------------------------------- */

const SLIDES = [
  {
    gif: require("../../assets/onboarding/onboarding_4_sharp.gif"),

    title: "Shop India, from Mauritius",

    body: "Browse Amazon, Myntra, Flipkart, Nykaa and more - all inside the Mr India app.",
  },

  {
    gif: require("../../assets/onboarding/onboarding_3_sharp.gif"),

    title: "Choose your product",

    body: "Select your preferred size and color, then tap Shop via Mr India to add the product to your Mr India cart.",
  },

  {
    gif: require("../../assets/onboarding/onboarding_2_sharp.gif"),

    title: "Verify & choose shipping",

    body: "Add product verification for MUR 100 if needed. Then choose Standard Shipping for MUR 200 with pickup in Port Louis, or Express Shipping for MUR 400 with home delivery.",
  },

  {
    gif: require("../../assets/onboarding/onboarding_1_sharp.gif"),

    title: "Pay & track your order",

    body: "Apply a promo code if you have one, use your wallet balance if available, then pay Mr India and review your order summary from the Orders screen.",
  },
];

/* -------------------------------------------------------------------------- */
/*                                 COMPONENT                                  */
/* -------------------------------------------------------------------------- */

export default function Onboarding() {
  const router = useRouter();

  const scrollX = useRef(new Animated.Value(0)).current;

  const [idx, setIdx] = useState(0);

  const ref = useRef<ScrollView>(null);

  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");

  const s = makeStyles(COLORS);

  /* ------------------------------------------------------------------------ */
  /*                                    NEXT                                  */
  /* ------------------------------------------------------------------------ */

  const next = () => {
    if (idx < SLIDES.length - 1) {
      ref.current?.scrollTo({
        x: (idx + 1) * width,
        animated: true,
      });
    } else {
      router.replace("/");
    }
  };

  return (
    <SafeAreaView style={s.wrap} edges={["top", "left", "right"]}>
      {/* -------------------------------------------------------------------- */}
      {/*                      PREVIOUS / SKIP BUTTONS                         */}
      {/* -------------------------------------------------------------------- */}

      <View style={s.topActions}>
        {idx > 0 ? (
          <TouchableOpacity
            style={s.topBtn}
            activeOpacity={0.7}
            onPress={() =>
              ref.current?.scrollTo({
                x: (idx - 1) * width,
                animated: true,
              })
            }
          >
            <Text style={s.topBtnTxt}>‹ Previous</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.topBtnPlaceholder} />
        )}

        <TouchableOpacity
          style={s.topBtn}
          activeOpacity={0.7}
          onPress={() => router.replace("/")}
        >
          <Text style={s.topBtnTxt}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* -------------------------------------------------------------------- */}
      {/*                               SLIDES                                 */}
      {/* -------------------------------------------------------------------- */}

      <Animated.ScrollView
        ref={ref as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [
            {
              nativeEvent: {
                contentOffset: {
                  x: scrollX,
                },
              },
            },
          ],
          {
            useNativeDriver: false,
          },
        )}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);

          setIdx(newIndex);
        }}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

          /*
           * Keep GIF animation scaling subtle.
           *
           * Going from 0.7 → 1 was making the recorded screen
           * visibly resize while swiping and can make it look softer.
           */
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.94, 1, 0.94],
            extrapolate: "clamp",
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: "clamp",
          });

          return (
            <View
              key={i}
              style={[
                s.slide,
                {
                  width,
                },
              ]}
            >
              {/* ------------------------------------------------------------ */}
              {/*                            GIF                               */}
              {/* ------------------------------------------------------------ */}

              <Animated.View
                style={[
                  s.gifOuter,
                  {
                    transform: [{ scale }],
                    opacity,
                  },
                ]}
              >
                <View style={s.gifContainer}>
                  <Image
                    source={slide.gif}
                    style={s.gif}
                    contentFit="contain"
                    transition={0}
                    cachePolicy="memory-disk"
                  />
                </View>
              </Animated.View>

              {/* ------------------------------------------------------------ */}
              {/*                           TEXT                               */}
              {/* ------------------------------------------------------------ */}

              <Text style={s.title}>{slide.title}</Text>

              <Text style={s.body}>{slide.body}</Text>
            </View>
          );
        })}
      </Animated.ScrollView>

      {/* -------------------------------------------------------------------- */}
      {/*                                DOTS                                  */}
      {/* -------------------------------------------------------------------- */}

      <View style={s.dots}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 26, 8],
            extrapolate: "clamp",
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={i}
              style={[
                s.dot,
                {
                  width: dotWidth,
                  opacity,
                },
              ]}
            />
          );
        })}
      </View>

      {/* -------------------------------------------------------------------- */}
      {/*                             NEXT BUTTON                              */}
      {/* -------------------------------------------------------------------- */}

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

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const makeStyles = (COLORS: any) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },

    /* ---------------------------------------------------------------------- */
    /*                                SLIDE                                   */
    /* ---------------------------------------------------------------------- */

    slide: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",

      /*
       * Smaller side padding gives the GIF more room.
       */
      paddingHorizontal: 24,

      /*
       * Leaves room for Previous / Skip.
       */
      paddingTop: 60,
    },

    /* ---------------------------------------------------------------------- */
    /*                                  GIF                                   */
    /* ---------------------------------------------------------------------- */

    gifOuter: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",

      marginBottom: 22,
    },

    gifContainer: {
      width: 268,
      aspectRatio: 384 / 832,
      borderRadius: 26,
      overflow: "hidden",
      backgroundColor: "#0F1722",
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: {
        width: 0,
        height: 10,
      },
      elevation: 10,
    },

    gif: {
      width: "100%",
      height: "100%",
    },

    /* ---------------------------------------------------------------------- */
    /*                                TEXT                                    */
    /* ---------------------------------------------------------------------- */

    title: {
      color: COLORS.t1,

      fontSize: 24,

      fontWeight: "800",

      textAlign: "center",

      letterSpacing: -0.5,

      paddingHorizontal: 10,
    },

    body: {
      color: COLORS.t2,

      fontSize: 14,

      lineHeight: 21,

      textAlign: "center",

      marginTop: 10,

      paddingHorizontal: 14,
    },

    /* ---------------------------------------------------------------------- */
    /*                                DOTS                                    */
    /* ---------------------------------------------------------------------- */

    dots: {
      flexDirection: "row",

      justifyContent: "center",

      alignItems: "center",

      gap: 8,

      marginBottom: 8,
    },

    dot: {
      height: 8,

      borderRadius: 4,

      backgroundColor: COLORS.amber,
    },

    /* ---------------------------------------------------------------------- */
    /*                               FOOTER                                   */
    /* ---------------------------------------------------------------------- */

    footer: {
      paddingHorizontal: 24,

      paddingTop: 10,

      paddingBottom: 32,
    },

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

      shadowOffset: {
        width: 0,
        height: 8,
      },

      elevation: 8,
    },

    ctaTxt: {
      color: "#FFFFFF",

      fontWeight: "900",

      fontSize: 16,
    },

    /* ---------------------------------------------------------------------- */
    /*                           PREVIOUS / SKIP                              */
    /* ---------------------------------------------------------------------- */

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
