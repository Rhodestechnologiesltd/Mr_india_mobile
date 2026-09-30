// src/app/fees.tsx â€” shipping, service, VAT and verification fees.
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

// Content sections explaining each type of fee to the customer.
const SECTIONS = [
  {
    title: "Product cost",
    body: [
      "The product cost is based on the price shown by the supported Indian store.",
      "Product prices may change before MR INDIA completes the purchase.",
      "The exchange rate applied by MR INDIA may vary because of currency fluctuations, bank charges and transfer fees.",
    ],
  },

  {
    title: "Service fee",
    body: [
      "The current MR INDIA service fee is MUR 200 per order.",
      "The service fee covers order processing, support and coordination.",
      "The service fee is non-refundable.",
    ],
  },

  {
    title: "Product verification",
    body: [
      "Product Verification is optional.",
      "Verification currently costs MUR 100 per verified product unit.",
      "When selected, MR INDIA sends product photos after the item reaches the MR INDIA warehouse in India.",
      "Customers have 12 hours to review and respond to the verification photos.",
      "Applicable verification and service fees are non-refundable.",
    ],
  },

  {
    title: "Shipping fees",
    body: [
      "Standard Shipping currently costs MUR 200 per product unit.",
      "Standard Shipping generally takes around three weeks and requires collection from the MR INDIA office in Port Louis.",
      "Express Shipping currently costs MUR 400 per product unit.",
      "Express Shipping generally takes around two weeks and includes delivery to the customer's doorstep.",
      "Products exceeding the stated weight or dimension limits may incur additional shipping charges.",
    ],
  },

  {
    title: "VAT",
    body: [
      "VAT is charged at 15% on applicable MR INDIA order charges.",
      "The VAT amount is calculated and displayed during checkout.",
      "The customer can review the full amount before confirming payment.",
    ],
  },

  {
    title: "Customs charges",
    body: [
      "Standard and Express shipments may be sent as consolidated shipments.",
      "Customers are not eligible for Mauritius Customs exemptions applicable to individual orders below Rs 1,000 where products form part of a consolidated shipment.",
      "Any applicable customs duties or other customs-related charges must be paid by the customer upon arrival of the order in Mauritius.",
    ],
  },

  {
    title: "Storage fee",
    body: [
      "Standard Shipping orders must be collected from the MR INDIA office in Port Louis.",
      "Customers have 21 days from the date of notification to collect their order.",
      "After 21 days, a storage fee of Rs 100 per day applies until the order is collected.",
      "MR INDIA may take necessary action regarding orders that remain uncollected.",
    ],
  },

  {
    title: "Refunds and wallet credits",
    body: [
      "All sales are final and MR INDIA does not normally accept returns or exchanges after payment.",
      "If a product is out of stock, the product amount and applicable shipping charges will be credited to the customer's MR INDIA Wallet.",
      "The service fee is non-refundable.",
      "Wallet credits cannot normally be withdrawn as cash and are intended for future purchases or services on MR INDIA.",
    ],
  },
];

export default function Fees() {
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
        {/* Header containing back navigation and the page icon. */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.replace("/account")}
            style={s.backBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={25} color={COLORS.t1} />
          </TouchableOpacity>

          <View style={s.iconBox}>
            <Ionicons name="receipt-outline" size={24} color={COLORS.amber} />
          </View>
        </View>

        {/* Page heading and introductory explanation. */}
        <Text style={s.title}>Shipping & fees</Text>

        <Text style={s.subtitle}>
          A clear breakdown of the main charges applied to your MR INDIA order.
        </Text>

        {/* Quick overview of the main charges. */}
        <View style={s.quickCard}>
          <Text style={s.quickTitle}>Quick summary</Text>

          <View style={s.quickRow}>
            <Text style={s.quickLabel}>Product cost</Text>
            <Text style={s.quickValue}>Vendor price</Text>
          </View>

          <View style={s.quickRow}>
            <Text style={s.quickLabel}>Service fee</Text>
            <Text style={s.quickValue}>MUR 200/order</Text>
          </View>

          <View style={s.quickRow}>
            <Text style={s.quickLabel}>Verification</Text>
            <Text style={s.quickValue}>Optional · MUR 100/product</Text>
          </View>

          <View style={s.quickRow}>
            <Text style={s.quickLabel}>Standard shipping</Text>
            <Text style={s.quickValue}>MUR 200/product</Text>
          </View>

          <View style={s.quickRow}>
            <Text style={s.quickLabel}>Express shipping</Text>
            <Text style={s.quickValue}>MUR 400/product</Text>
          </View>

          <View style={s.quickRow}>
            <Text style={s.quickLabel}>VAT</Text>
            <Text style={s.quickValue}>15%</Text>
          </View>

          <View style={s.quickRow}>
            <Text style={s.quickLabel}>Storage</Text>
            <Text style={s.quickValue}>Rs 100/day after 21 days</Text>
          </View>
        </View>

{/* Render each detailed fee section with a heading and bullet points. */}
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

        {/* Reminder that final charges can depend on the completed order. */}
        <Text style={s.footerNote}>
          All MR INDIA charges are shown during checkout before payment. Additional customs-related charges may apply separately upon arrival in Mauritius.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
// Create theme-aware styles for the shipping and fees screen.
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

    quickCard: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      marginBottom: 18,
    },

    quickTitle: {
      color: COLORS.t1,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 12,
    },

    quickRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },

    quickLabel: {
      color: COLORS.t2,
      fontSize: 13.5,
      fontWeight: "700",
      flex: 1,
    },

    quickValue: {
      color: COLORS.amber,
      fontSize: 13.5,
      fontWeight: "900",
      textAlign: "right",
      flex: 1,
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




