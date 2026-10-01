// src/app/account.tsx  profile / account tab.

// UI, navigation, theming, and shared application state dependencies.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, getColors, GRAD, useStore } from "../lib/mrindia";

export default function Account() {
  // Provides navigation to the account-related screens.
  const router = useRouter();
  // Build the active color palette and styles from the device color scheme.
  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);
  // Read the current user and session action from the shared store.
  const { user, signOut } = useStore();
  const [odooAccount, setOdooAccount] = useState<any>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    (async () => {
      try {
        const result = await api.getMiServicesPricing();

        console.log(
          "========== ODOO MI SERVICES ==========",
          JSON.stringify(result, null, 2),
        );
      } catch (error) {
        console.log("MI SERVICES ERROR:", error);
      }
    })();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadAccount() {
        if (!user) {
          setOdooAccount(null);
          return;
        }

        try {
          setAccountLoading(true);

          console.log("========== LOAD ODOO ACCOUNT ==========");

          const result = await api.myAccount();

          console.log("ODOO ACCOUNT RESULT:");
          console.log(JSON.stringify(result, null, 2));

          if (active) {
            setOdooAccount(result);
          }
        } catch (error) {
          console.log("ODOO ACCOUNT ERROR:");
          console.log(JSON.stringify(error, null, 2));
        } finally {
          if (active) {
            setAccountLoading(false);
          }
        }
      }

      loadAccount();

      return () => {
        active = false;
      };
    }, [user]),
  );

  const accountData =
    odooAccount?.data ??
    odooAccount?.customer ??
    odooAccount?.profile ??
    odooAccount ??
    {};

  const displayName =
    accountData?.customerName ||
    accountData?.name?.value ||
    accountData?.full_name ||
    user?.full_name ||
    user?.name ||
    "Mr India Customer";

  const displayEmail =
    accountData?.customerEmail ||
    accountData?.email?.value ||
    user?.email ||
    "";

  // Primary account actions displayed in the first menu group.
  const ROWS = [
    {
      icon: "cube-outline",
      label: "My orders",
      sub: "View and track your purchases",
      onPress: () => router.push("/orders"),
    },
    {
      icon: "wallet-outline",
      label: "My Wallet",
      sub: "View your balance and wallet activity",
      onPress: () => router.push("/wallet"),
    },
    {
      icon: "location-outline",
      label: "Saved Addresses",
      sub: "Manage delivery and billing addresses",
      onPress: () => router.push("/addresses"),
    },
    {
      icon: "play-circle-outline",
      label: "How it works",
      sub: "Quick guide for shopping with Mr India",
      onPress: () => router.push("/onboarding"),
    },
    {
      icon: "help-circle-outline",
      label: "Help & support",
      sub: "Get assistance with your order",
      onPress: () => {},
    },
  ];

  // Shipping, policy, and legal links displayed in a separate menu group.
  const POLICY_ROWS = [
    {
      icon: "receipt-outline",
      label: "Shipping & fees",
      sub: "Delivery, service fee, VAT and verification fee",
      onPress: () => router.push("/fees" as any),
    },
    {
      icon: "shield-checkmark-outline",
      label: "What we can ship",
      sub: "Eligible, restricted and prohibited items",
      onPress: () => router.push("/shipping-rules" as any),
    },
    {
      icon: "document-text-outline",
      label: "Terms & Conditions",
      sub: "Read Mr India's full terms and conditions",
      onPress: () => router.push("/terms" as any),
    },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={s.wrap}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.pageTitle}>Account</Text>

        {user ? (
          <View style={s.userHeader}>
            <LinearGradient colors={GRAD} style={s.avatar}>
              <Text style={s.avatarTxt}>
                {String(displayName || displayEmail || "U")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </LinearGradient>

            <View style={{ flex: 1 }}>
              <Text style={s.name}>{displayName}</Text>
              <Text style={s.email}>{displayEmail}</Text>
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={
              scheme === "dark"
                ? ["#1E2E3A", "#131F2A"]
                : ["#FFFFFF", "#F6EBD8"]
            }
            style={s.signedOut}
          >
            <View style={s.signIcon}>
              <Ionicons name="person-outline" size={32} color={COLORS.amber} />
            </View>

            <Text style={s.soTitle}>Sign in to Mr India</Text>

            <Text style={s.soSub}>
              Track orders, check out faster, and keep your cart across devices.
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/signin")}
              activeOpacity={0.9}
              style={{ alignSelf: "stretch", marginTop: 18 }}
            >
              <LinearGradient
                colors={GRAD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.cta}
              >
                <Text style={s.ctaTxt}>Sign in or create account</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        )}

        <Text style={s.sectionLabel}>Account</Text>

        <View style={s.list}>
          {ROWS.map((r, i) => (
            <TouchableOpacity
              key={i}
              style={[s.row, i < ROWS.length - 1 && s.rowBorder]}
              onPress={r.onPress}
              activeOpacity={0.75}
            >
              <View style={s.rowIcon}>
                <Ionicons name={r.icon as any} size={21} color={COLORS.amber} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{r.label}</Text>
                <Text style={s.rowSub}>{r.sub}</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={COLORS.t3} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionLabel}>Policies & fees</Text>

        <View style={s.list}>
          {POLICY_ROWS.map((r, i) => (
            <TouchableOpacity
              key={i}
              style={[s.row, i < POLICY_ROWS.length - 1 && s.rowBorder]}
              onPress={r.onPress}
              activeOpacity={0.75}
            >
              <View style={s.rowIcon}>
                <Ionicons name={r.icon as any} size={21} color={COLORS.amber} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{r.label}</Text>
                <Text style={s.rowSub}>{r.sub}</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={COLORS.t3} />
            </TouchableOpacity>
          ))}
        </View>
        {/* Only signed-in users need access to the sign-out action. */}
        {user ? (
          <>
            <Text style={s.sectionLabel}>Session</Text>

            <TouchableOpacity
              style={s.signout}
              onPress={signOut}
              activeOpacity={0.75}
            >
              <View style={[s.rowIcon, s.signoutIcon]}>
                <Ionicons
                  name="log-out-outline"
                  size={21}
                  color={COLORS.rose}
                />
              </View>

              <Text style={s.signoutTxt}>Sign out</Text>

              <Ionicons name="chevron-forward" size={20} color={COLORS.t3} />
            </TouchableOpacity>
          </>
        ) : null}

        <Text style={s.trustFooter}>
          Secure shopping - Mauritius delivery - Order tracking
        </Text>

        <Text style={s.version}>Mr India - mrindia.mu - v2</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Create theme-aware styles whenever the active color palette changes.
const makeStyles = (COLORS: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },

    wrap: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 120,
    },

    pageTitle: {
      color: COLORS.t1,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -1,
      marginBottom: 18,
    },

    userHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 26,
    },

    avatar: {
      width: 78,
      height: 78,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: COLORS.gold,
    },

    avatarTxt: {
      color: "#FFFFFF",
      fontSize: 34,
      fontWeight: "900",
    },

    name: {
      color: COLORS.t1,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.4,
    },

    email: {
      color: COLORS.t3,
      fontSize: 14,
      marginTop: 4,
    },

    signedOut: {
      borderRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 22,
      paddingBottom: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 24,
      shadowColor: "#000",
      shadowOpacity: COLORS.bg === "#131F2A" ? 0.18 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },

    signIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: COLORS.bg2,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },

    soTitle: {
      color: COLORS.t1,
      fontSize: 21,
      fontWeight: "900",
      textAlign: "center",
    },

    soSub: {
      color: COLORS.t2,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 21,
      marginTop: 8,
    },

    cta: {
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },

    ctaTxt: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 15,
    },

    sectionLabel: {
      color: COLORS.t3,
      fontSize: 13,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 2,
      marginBottom: 10,
      marginLeft: 6,
      marginTop: 4,
    },

    list: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: "hidden",
      marginBottom: 24,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 17,
    },

    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },

    rowIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: COLORS.bg2,
      alignItems: "center",
      justifyContent: "center",
    },

    rowLabel: {
      color: COLORS.t1,
      fontSize: 16,
      fontWeight: "800",
    },

    rowSub: {
      color: COLORS.t3,
      fontSize: 12.5,
      marginTop: 3,
      lineHeight: 17,
    },

    signout: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: COLORS.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginBottom: 18,
    },

    signoutIcon: {
      backgroundColor:
        COLORS.bg === "#131F2A"
          ? "rgba(181,90,75,0.16)"
          : "rgba(181,90,75,0.10)",
    },

    signoutTxt: {
      flex: 1,
      color: COLORS.rose,
      fontWeight: "900",
      fontSize: 16,
    },

    trustFooter: {
      color: COLORS.t2,
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
      marginBottom: 6,
      fontWeight: "600",
    },

    version: {
      color: COLORS.t3,
      fontSize: 11,
      textAlign: "center",
      marginTop: 4,
      opacity: 0.85,
    },
  });
