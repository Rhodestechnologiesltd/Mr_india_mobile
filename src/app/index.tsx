// src/app/index.tsx - premium animated home. Big gradient store cards,
// animated entrance, hero, how-it-works, and guidance.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
//import { api, getColors, GRAD, money, STORES } from "../lib/mrindia";
import { api, getColors, GRAD, money, STORES } from "../lib/mrindia";

// Calculate the width of each store card from the device screen width.
const { width } = Dimensions.get("window");
const CARD_W = (width - 16 * 2 - 14) / 2;

// Store categories available in the filter.
const CATS = ["All", "Fashion", "Beauty", "Electronics"];

// Load the local Mr India logo image.
const MR_INDIA_LOGO = require("../../assets/images/logos/Mr.india.jpeg");

// Fade + rise on mount
// Reusable entrance-animation wrapper that fades and lifts its children.
function Rise({ children, delay = 0, style }: any) {
  const a = useRef(new Animated.Value(0)).current;

  // Start the entrance animation when the component mounts.
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 520,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: a,
          transform: [
            {
              translateY: a.interpolate({
                inputRange: [0, 1],
                outputRange: [22, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Animated card used to display and open an individual Indian store.
function StoreCard({ store, index, onPress, s }: any) {
  // Control the press-scale effect and entrance animation.
  const scale = useRef(new Animated.Value(1)).current;
  const a = useRef(new Animated.Value(0)).current;

  // Stagger the store-card entrance based on its position in the grid.
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 480,
      delay: 120 + index * 70,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: a,
        width: CARD_W,
        marginBottom: 14,
        transform: [
          { scale },
          {
            translateY: a.interpolate({
              inputRange: [0, 1],
              outputRange: [26, 0],
            }),
          },
        ],
      }}
    >
      {/* Scale the card down slightly while it is being pressed. */}
      <Pressable
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
          }).start()
        }
        onPress={onPress}
      >
        <LinearGradient
          colors={store.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.storeCard}
        >
          {/* Display the store logo or fall back to its emoji. */}
          <View style={s.bigLogoBox}>
            {store.logo ? (
              <Image
                source={store.logo}
                style={s.bigStoreLogo}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ fontSize: 44 }}>{store.emoji}</Text>
            )}
          </View>

          <View style={s.cardBottom}>
            <Text style={s.shopNow}>
              Shop now <Ionicons name="arrow-forward" size={15} color="#fff" />
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export default function Home() {
  // Provides navigation to stores, account, and onboarding screens.
  const router = useRouter();

  // Track the selected store category and splash-screen visibility.
  const [cat, setCat] = useState("All");

  const [odooPricing, setOdooPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  // Create the active color palette and styles from the device color scheme.
  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);

  // Refresh Mr India pricing whenever the Home screen receives focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadHomePricing() {
        try {
          setPricingLoading(true);

          const result = await api.getMiServicesPricing();

          if (active) {
            setOdooPricing(result?.data || null);
          }
        } catch (error) {
          console.log("HOME PRICING ERROR:", error);

          if (active) {
            setOdooPricing(null);
          }
        } finally {
          if (active) {
            setPricingLoading(false);
          }
        }
      }

      loadHomePricing();

      return () => {
        active = false;
      };
    }, []),
  );

  // Filter the store list using the selected category.
  const stores = STORES.filter((x) => cat === "All" || x.cat === cat);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={s.wrap}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}

        {/* Brand introduction, account shortcut, and service benefits. */}
        <LinearGradient colors={[COLORS.hero1, COLORS.hero2]} style={s.hero}>
          <Rise>
            <View style={s.brandRow}>
              <View style={s.brandLogoWrap}>
                <Image
                  source={MR_INDIA_LOGO}
                  style={s.brandLogo}
                  resizeMode="contain"
                />
              </View>

              <Text style={s.brand}>
                Mr <Text style={{ color: COLORS.amber }}>India</Text>
              </Text>

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                onPress={() => router.push("/account")}
                style={s.profileBtn}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={26}
                  color={COLORS.t2}
                />
              </TouchableOpacity>
            </View>
          </Rise>

          {/* Main service message. */}
          <Rise delay={90}>
            <Text style={s.heroTitle}>
              India's finest,{"\n"}delivered to your door
            </Text>
            <Text style={s.heroSub}>
              Shop any Indian store. We buy it, verify it, and ship it to
              Mauritius. You pay us - simple and secure.
            </Text>
          </Rise>

          {/* Short trust indicators describing the service benefits. */}
          <Rise delay={170}>
            <View style={s.trustRow}>
              <View style={s.trustItem}>
                <Ionicons
                  name="shield-checkmark"
                  size={15}
                  color={COLORS.teal}
                />
                <Text style={s.trustTxt}>Verified items</Text>
              </View>
              <View style={s.trustItem}>
                <Ionicons name="airplane" size={15} color={COLORS.teal} />
                <Text style={s.trustTxt}>Fast shipping</Text>
              </View>
              <View style={s.trustItem}>
                <Ionicons name="lock-closed" size={15} color={COLORS.teal} />
                <Text style={s.trustTxt}>Secure pay</Text>
              </View>
            </View>
          </Rise>
        </LinearGradient>

        {/* Section header */}
        <Rise delay={120}>
          <View style={s.secHead}>
            <Text style={s.h}>Shop by store</Text>
            <Text style={s.hSub}>Tap a store to browse it inside Mr India</Text>
          </View>
        </Rise>

        {/* Category chips */}
        {/* Horizontally scrollable store-category filters. */}
        <Rise delay={160}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: 16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 9 }}
          >
            {CATS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCat(c)}
                style={[s.chip, cat === c && s.chipOn]}
              >
                <Text style={[s.chipTxt, cat === c && { color: "#FFFFFF" }]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Rise>

        {/* Big store cards */}
        {/* Open the selected store inside the application's browser screen. */}
        <View style={s.grid}>
          {stores.map((store, i) => (
            <StoreCard
              key={store.id}
              store={store}
              index={i}
              s={s}
              onPress={() =>
                router.push({
                  pathname: "/browser",
                  params: { url: store.url, name: store.name },
                })
              }
            />
          ))}
        </View>

        {/* How it works */}
        {/* Step-by-step explanation of the Mr India shopping process. */}
        <Rise delay={120}>
          <View style={s.howWrap}>
            <Text style={s.h}>How it works</Text>
            {[
              [
                "compass-outline",
                "Browse any store",
                "Open Amazon, Myntra, Flipkart & more right inside the app.",
              ],
              [
                "bag-add-outline",
                'Tap "Shop via Mr India"',
                "The floating button adds the product to your Mr India cart.",
              ],
              [
                "card-outline",
                "Pay Mr India once",
                "Choose Express or Standard shipping and pay securely in MUR.",
              ],
              [
                "cube-outline",
                "We buy, verify & ship",
                "Our India team purchases and forwards it to your door in Mauritius.",
              ],
            ].map((x, i) => (
              <View key={i} style={s.howRow}>
                <LinearGradient colors={GRAD} style={s.howIcon}>
                  <Ionicons name={x[0] as any} size={18} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={s.howStep}>{x[1]}</Text>
                  <Text style={s.howDesc}>{x[2]}</Text>
                </View>
              </View>
            ))}
          </View>
        </Rise>

        {/* Shipping guidance */}
        {/* Shipping prices, delivery estimates, and product restrictions. */}
        <Rise delay={120}>
          <View style={s.guideWrap}>
            <Text style={s.h}>Shipping & rules</Text>
            <View style={s.guideRow}>
              <View style={s.guideCard}>
                <Ionicons name="flash" size={18} color={COLORS.amber} />
                <Text style={s.guideTitle}>Express</Text>
                <Text style={s.guidePrice}>
                  {pricingLoading ? "Loading..." : money(Number(odooPricing?.express_shipping?.price || 0))}
                </Text>
                <Text style={s.guideMeta}>per product - ~7 days</Text>
              </View>
              <View style={s.guideCard}>
                <Ionicons name="boat" size={18} color={COLORS.teal} />
                <Text style={s.guideTitle}>Standard</Text>
                <Text style={s.guidePrice}>
                  {pricingLoading ? "Loading..." : money(Number(odooPricing?.standard_shipping?.price || 0))}
                </Text>
                <Text style={s.guideMeta}>per product - ~2 weeks</Text>
              </View>
            </View>
            <View style={s.eligible}>
              <Text style={s.eligibleTxt}>
                Apparel & light goods - Max 1kg/product - No liquids - No
                electronics
              </Text>
              <Text style={s.eligibleTxt}>
                Optional product verification: {pricingLoading ? "Loading..." : money(Number(odooPricing?.verification_fee?.price || 0))}/product
              </Text>
            </View>
          </View>
        </Rise>

        {/* Link to the detailed onboarding guide. */}
        <Rise delay={120}>
          <TouchableOpacity
            onPress={() => router.push("/onboarding")}
            style={s.guideLink}
          >
            <Ionicons
              name="play-circle-outline"
              size={18}
              color={COLORS.amber}
            />
            <Text style={s.guideLinkTxt}>Watch the quick guide</Text>
          </TouchableOpacity>
        </Rise>
        {/* </ScrollView>
  );
} */}
      </ScrollView>
    </SafeAreaView>
  );
}

// Create theme-aware styles for the home and splash screens.
const makeStyles = (COLORS: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    wrap: { flex: 1, backgroundColor: COLORS.bg },
    hero: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
    brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
    brandBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },
    brand: { color: COLORS.t1, fontSize: 20, fontWeight: "800" },
    profileBtn: { padding: 2 },
    heroTitle: {
      color: COLORS.t1,
      fontSize: 30,
      fontWeight: "900",
      lineHeight: 39,
      letterSpacing: -0.8,
    },
    heroSub: { color: COLORS.t2, fontSize: 14, lineHeight: 21, marginTop: 12 },
    trustRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 20,
    },

    trustItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
    },
    trustTxt: { color: COLORS.t2, fontSize: 12, fontWeight: "600" },
    secHead: { paddingHorizontal: 16, marginTop: 22, marginBottom: 12 },
    h: {
      color: COLORS.t1,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    hSub: { color: COLORS.t3, fontSize: 13, marginTop: 3 },
    chip: {
      paddingHorizontal: 17,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    chipOn: { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
    chipTxt: { color: COLORS.t2, fontWeight: "700", fontSize: 13 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      justifyContent: "space-between",
    },

    ribbon: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: "rgba(0,0,0,0.28)",
      borderRadius: 7,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    ribbonTxt: {
      color: "#fff",
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 0.5,
    },

    howWrap: {
      marginHorizontal: 16,
      marginTop: 30,
      backgroundColor: COLORS.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 22,
    },

    howRow: {
      flexDirection: "row",
      gap: 15,
      marginTop: 18,
      alignItems: "flex-start",
    },
    howIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    howStep: { color: COLORS.t1, fontWeight: "700", fontSize: 14.5 },
    howDesc: { color: COLORS.t2, fontSize: 13, lineHeight: 19, marginTop: 2 },
    guideWrap: { marginHorizontal: 16, marginTop: 22 },
    guideRow: { flexDirection: "row", gap: 12, marginTop: 12 },
    guideCard: {
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
    },
    guideTitle: {
      color: COLORS.t1,
      fontWeight: "800",
      fontSize: 14,
      marginTop: 8,
    },
    guidePrice: {
      color: COLORS.amber,
      fontWeight: "800",
      fontSize: 18,
      marginTop: 4,
    },
    guideMeta: { color: COLORS.t3, fontSize: 11, marginTop: 2 },
    eligible: {
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      marginTop: 12,
      gap: 6,
    },
    eligibleTxt: { color: COLORS.t2, fontSize: 12, lineHeight: 17 },
    guideLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      marginTop: 20,
    },
    guideLinkTxt: { color: COLORS.amber, fontWeight: "700", fontSize: 14 },

    brandLogoWrap: {
      width: 58,
      height: 42,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },

    brandLogo: {
      width: 52,
      height: 38,
    },

    storeCard: {
      borderRadius: 22,
      padding: 12,
      height: 172,
      justifyContent: "space-between",
      overflow: "hidden",
      borderWidth: 1,
      //   borderColor: "rgba(255,255,255,0.18)",
      borderColor:
        COLORS.bg === "#131F2A"
          ? "rgba(255,255,255,0.14)"
          : "rgba(255,255,255,0.18)",
    },

    bigLogoBox: {
      height: 120,
      borderRadius: 18,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },

    bigStoreLogo: {
      width: "90%",
      height: "90%",
    },

    cardBottom: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingTop: 8,
    },

    shopNow: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 13,
    },

    splashSafe: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },

    splashWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      backgroundColor: COLORS.bg,
    },

    splashLogoBox: {
      width: 230,
      height: 120,
      borderRadius: 30,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: "#000000",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
      marginBottom: 28,
      overflow: "hidden",
    },

    splashLogo: {
      width: 185,
      height: 95,
    },

    splashTitle: {
      color: COLORS.t1,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: 2,
      marginTop: 4,
    },

    splashTagline: {
      color: COLORS.amber,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 4,
      marginTop: 10,
      textAlign: "center",
    },

    splashLineTrack: {
      width: 230,
      height: 4,
      borderRadius: 999,
      backgroundColor:
        COLORS.bg === "#131F2A"
          ? "rgba(255,255,255,0.12)"
          : "rgba(225,108,0,0.12)",
      marginTop: 42,
      overflow: "hidden",
    },

    splashLineFill: {
      width: 90,
      height: 4,
      borderRadius: 999,
      backgroundColor: COLORS.amber,
    },

    splashLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 24,
    },

    splashLoadingText: {
      color: COLORS.t3,
      fontSize: 13,
      fontWeight: "700",
    },
  });
