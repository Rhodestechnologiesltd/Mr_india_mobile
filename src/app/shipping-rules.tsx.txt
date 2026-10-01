// src/app/shipping-rules.tsx â€” what Mr India can and cannot ship.
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getColors } from "../lib/mrindia";

// Content sections describing allowed, restricted, and prohibited products.
const SECTIONS = [
  {
    title: "Standard Shipping · MUR 200",
    body: [
      "Standard Shipping costs MUR 200 per product unit.",
      "Orders generally arrive within around three weeks.",
      "Standard Shipping orders must be collected from the MR INDIA office in Port Louis.",
      "Collection hours are between 10:00 a.m. and 4:30 p.m.",
      "The shipping fee covers transportation from India to Mauritius, including applicable shipping and handling costs.",
      "Standard shipments are consolidated shipments.",
    ],
  },

  {
    title: "Express Shipping · MUR 400",
    body: [
      "Express Shipping costs MUR 400 per product unit.",
      "Orders generally arrive within around two weeks.",
      "Express Shipping includes delivery to the customer's doorstep.",
      "The shipping fee covers transportation from India to Mauritius and delivery to the customer's doorstep, including applicable shipping and handling costs.",
    ],
  },

  {
    title: "VAT",
    body: [
      "VAT is charged at 15% on applicable MR INDIA order charges.",
      "The applicable VAT amount is calculated and shown during checkout before payment.",
    ],
  },

  {
    title: "Weight and size limits",
    body: [
      "Individual products should not exceed 1 kg.",
      "Individual products should not exceed 1 foot in length, width or height.",
      "Products exceeding these limits may incur additional shipping charges.",
      "Additional charges may be calculated using volumetric weight.",
      "Any additional charge will be communicated by MR INDIA and must be paid before shipment.",
    ],
  },

  {
    title: "Customs and consolidated shipments",
    body: [
      "Standard and Express shipments may be sent as consolidated shipments.",
      "Customers are not eligible for Mauritius Customs exemptions applicable to individual orders below Rs 1,000 where products form part of a consolidated shipment.",
      "Any applicable customs duties or other customs-related charges must be paid by the customer upon arrival of the order in Mauritius.",
    ],
  },

  {
    title: "Prohibited edible products",
    body: [
      "MR INDIA does not permit the purchase or shipment of edible products.",
      "This includes sweets, snacks, dairy products and short-expiry food.",
      "Spices, condiments and restricted powders are also prohibited.",
      "Orders containing prohibited items may be cancelled or refused for shipment.",
    ],
  },

  {
    title: "Collection and storage",
    body: [
      "Standard Shipping customers have 21 days from the date of notification to collect their order.",
      "After 21 days, a storage fee of Rs 100 per day applies until the order is collected.",
      "Customers are encouraged to collect their orders within the stated timeframe.",
      "MR INDIA may take necessary action regarding orders that remain uncollected.",
      "MR INDIA is not responsible for loss or damage to uncollected items after the stated collection period.",
    ],
  },

  {
    title: "Shipping liability and handling",
    body: [
      "MR INDIA and Kartxport are not responsible for loss, damage or breakage caused during transportation or handling by third-party shipping providers.",
      "Customers should inspect their packages when received.",
      "Shipping-related issues should be reported to the relevant shipping provider immediately.",
      "Price tags will be removed from purchased items before shipment.",
    ],
  },
];

export default function ShippingRules() {
  // Provides navigation back to the previous or account screen.
  const router = useRouter();

  // Create the active color palette and styles from the device color scheme.
  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={s.wrap}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header containing back navigation and the shipping-rules icon. */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.replace("/account")}
            style={s.backBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={25} color={COLORS.t1} />
          </TouchableOpacity>

          <View style={s.iconBox}>
            <Ionicons
              name="shield-checkmark-outline"
              size={24}
              color={COLORS.amber}
            />
          </View>
        </View>

        {/* Page heading and introductory guidance. */}
        <Text style={s.title}>Shipping rules</Text>

        <Text style={s.subtitle}>
          Check shipping prices, delivery methods, VAT, product limits and prohibited items before placing an order.
        </Text>

        {/* Quick summary of the most important shipping rules. */}
        <View style={s.summaryCard}>
          <Text style={s.summaryText}>
            Standard · MUR 200/product · ~3 weeks · Port Louis pickup
          </Text>

          <Text style={s.summaryText}>
            Express · MUR 400/product · ~2 weeks · Home delivery
          </Text>

          <Text style={s.summaryText}>
            VAT · 15%
          </Text>

          <Text style={s.summaryText}>
            Maximum standard product size · 1 kg and 1 foot in any dimension
          </Text>

          <Text style={s.summaryText}>
            Edible products are not permitted
          </Text>
        </View>

{/* Render each rules section with its associated bullet points. */}
        <View style={s.card}>
          {SECTIONS.map((sec, i) => (
            <View
              key={i}
              style={[
                s.sectionBlock,
                i < SECTIONS.length - 1 && s.sectionBorder,
              ]}
            >
              <Text style={s.sectionTitle}>{sec.title}</Text>

              {sec.body.map((line, j) => (
                <View key={j} style={s.bulletRow}>
                  <View style={s.dot} />
                  <Text style={s.bodyText}>{line}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Direct customers to support when a product's eligibility is unclear. */}
        <Text style={s.footerNote}>
          If you are unsure whether a product can be shipped, contact MR INDIA support before placing your order.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Create theme-aware styles for the shipping-rules screen.
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

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },

    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: COLORS.bg2,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
    },

    iconBox: {
      width: 50,
      height: 50,
      borderRadius: 18,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
    },

    title: {
      color: COLORS.t1,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -1,
      marginBottom: 8,
    },

    subtitle: {
      color: COLORS.t3,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 20,
    },

    summaryCard: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      marginBottom: 18,
      gap: 10,
    },

    summaryText: {
      color: COLORS.t2,
      fontSize: 13.5,
      lineHeight: 20,
      fontWeight: "700",
    },

    card: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: "hidden",
    },

    sectionBlock: {
      padding: 18,
    },

    sectionBorder: {
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },

    sectionTitle: {
      color: COLORS.t1,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 12,
    },

    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      marginBottom: 9,
    },

    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.amber,
      marginTop: 7,
    },

    bodyText: {
      flex: 1,
      color: COLORS.t2,
      fontSize: 13.5,
      lineHeight: 20,
    },

    footerNote: {
      color: COLORS.t3,
      fontSize: 12.5,
      textAlign: "center",
      lineHeight: 18,
      marginTop: 18,
      paddingHorizontal: 10,
    },
  });




