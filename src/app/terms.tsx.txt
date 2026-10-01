// src/app/terms.tsx â€” Mr India terms and conditions screen.
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

// Structured legal content displayed as sections with bullet points.
const TERMS_SECTIONS = [
  {
    title: "Introduction",
    body: [
      "These Terms and Conditions are effective from October 2026.",
      "These Terms govern access to and use of the MR INDIA website, application, platform and services.",
      "MR INDIA facilitates access to products available from supported Indian online stores and marketplaces for customers in Mauritius.",
      "By using the Platform, submitting information, placing an order or accessing a MR INDIA service, you agree to comply with these Terms and any other applicable policies or conditions.",
    ],
  },

  {
    title: "Acceptance of terms",
    body: [
      "By accessing, browsing or using MR INDIA, you confirm that you have read, understood and accepted these Terms.",
      "You must be at least 18 years old to use MR INDIA independently and enter into transactions.",
      "Users under 18 may use the Platform only under the supervision and involvement of a parent or legal guardian where permitted by law.",
      "Customers are responsible for reviewing the latest Terms and any additional conditions applicable to a service or transaction.",
    ],
  },

  {
    title: "User account",
    body: [
      "Customers must provide accurate, complete and up-to-date information when registering.",
      "Customers are responsible for keeping their account and contact information current.",
      "Login credentials, passwords and security codes must be kept confidential.",
      "MR INDIA may suspend accounts where there is evidence of fraud, unauthorised transactions, misuse, violation of these Terms or unlawful activity.",
    ],
  },

  {
    title: "Digital wallet",
    body: [
      "MR INDIA provides a digital wallet for eligible purchases and services on the Platform.",
      "Customers may use available Wallet funds towards eligible purchases.",
      "If the Wallet balance is insufficient, the remaining amount must be paid using another available payment method.",
      "Eligible refunds are generally credited to the MR INDIA Wallet.",
      "MR INDIA does not normally refund eligible amounts directly to a bank account or original payment method.",
      "Wallet funds are generally intended for future purchases and services on the MR INDIA Platform.",
    ],
  },

  {
    title: "Promotional coupons",
    body: [
      "Promotional coupons may be subject to minimum purchase amounts, eligible products and other restrictions.",
      "Coupons may be applied at checkout to eligible purchases.",
      "Unless otherwise stated, only one coupon may be used per transaction.",
      "Coupons are valid only until their stated expiration date.",
      "Coupons are non-transferable and cannot be sold, exchanged or redeemed for cash.",
    ],
  },

  {
    title: "Product information",
    body: [
      "Product descriptions and specifications originate from the relevant Indian vendor website.",
      "Customers should carefully review size, colour, material and other important product information before purchasing.",
      "Prices are shown in the currency displayed by the vendor and may change without notice.",
      "The exchange rate applied by MR INDIA may vary because of currency fluctuations, bank charges and transfer fees.",
      "Product images may vary because of lighting, photography and display settings.",
      "Reviews and ratings represent individual user opinions and are not guaranteed or endorsed by MR INDIA.",
    ],
  },

  {
    title: "Ordering process",
    body: [
      "Customers may purchase eligible products from supported Indian online stores through the MR INDIA website or application.",
      "Customers must provide the required product details such as size, colour, quantity and other relevant options.",
      "Payment may include the product cost, verification fee, service fee, shipping fee and VAT.",
      "Once payment is confirmed, MR INDIA will process the order on the customer's behalf.",
      "Orders are generally processed within 24 hours.",
      "Orders placed during weekends are generally processed on the next working day.",
    ],
  },

  {
    title: "Current service charges",
    body: [
      "The current MR INDIA service fee is MUR 200 per order.",
      "Product Verification is optional and currently costs MUR 100 per verified product unit.",
      "Standard Shipping currently costs MUR 200 per product unit.",
      "Express Shipping currently costs MUR 400 per product unit.",
      "VAT is charged at 15% on applicable MR INDIA order charges.",
      "All applicable charges are shown during checkout before the customer confirms payment.",
    ],
  },

  {
    title: "Product verification",
    body: [
      "MR INDIA offers an optional Product Verification service.",
      "When selected, customers receive photos after the product reaches the MR INDIA warehouse in India.",
      "After receiving the photos, the customer may accept the product for shipment or request cancellation.",
      "Applicable verification and service fees remain payable and are non-refundable.",
      "If the customer does not respond within 12 hours, the product is considered accepted and MR INDIA may proceed with shipment.",
    ],
  },

  {
    title: "Payment terms",
    body: [
      "MR INDIA may accept Blink by Emtel, bank transfer, PayPal and the MR INDIA Wallet.",
      "Product prices may change because of supplier pricing, exchange rates, taxes or other applicable charges.",
      "If the price increases before the purchase is completed, the customer must pay the difference before MR INDIA proceeds.",
      "Orders are processed only after payment has been successfully received and confirmed.",
      "Customers are responsible for ensuring that their selected payment method is valid, active and has sufficient funds.",
    ],
  },

  {
    title: "Standard shipping",
    body: [
      "Standard Shipping currently costs MUR 200 per product unit.",
      "Standard Shipping orders generally arrive within three weeks.",
      "Orders must be collected from the MR INDIA office in Port Louis.",
      "Collection hours are between 10:00 a.m. and 4:30 p.m.",
      "The Standard Shipping fee covers transportation from India to Mauritius, including applicable shipping and handling costs.",
      "Standard shipments are consolidated shipments.",
      "Customers have 21 days from the date of notification to collect their order.",
      "After the 21-day collection period, a storage fee of Rs 100 per day applies until the order is collected.",
      "MR INDIA may take necessary action regarding orders that remain uncollected.",
    ],
  },

  {
    title: "Express shipping",
    body: [
      "Express Shipping currently costs MUR 400 per product unit.",
      "Express Shipping orders generally arrive within two weeks.",
      "Express Shipping includes delivery to the customer's doorstep.",
      "The Express Shipping fee covers transportation from India to Mauritius and delivery to the customer's doorstep, including applicable shipping and handling costs.",
    ],
  },

  {
    title: "VAT and customs",
    body: [
      "VAT is charged at 15% on applicable MR INDIA order charges.",
      "Standard and Express shipments may be sent as consolidated shipments.",
      "Customers are not eligible for Mauritius Customs exemptions applicable to individual orders below Rs 1,000 when products are shipped as part of consolidated shipments.",
      "Any applicable customs duties or other customs-related charges must be paid by the customer upon arrival of the order in Mauritius.",
    ],
  },

  {
    title: "Product weight and dimensions",
    body: [
      "Individual products should not exceed 1 kg.",
      "Individual products should not exceed 1 foot in length, width or height.",
      "Products exceeding these limits may be subject to additional shipping charges.",
      "Additional shipping charges may be calculated using volumetric weight.",
      "Any additional charge will be communicated by MR INDIA and must be paid before shipment.",
    ],
  },

  {
    title: "Shipping liability and handling",
    body: [
      "MR INDIA and Kartxport are not responsible for loss, damage or breakage caused during transportation or handling by third-party shipping providers.",
      "Customers should inspect packages when received.",
      "Shipping-related issues should be reported to the relevant shipping provider immediately.",
      "Price tags will be removed from purchased items before shipment.",
    ],
  },

  {
    title: "Prohibited edible products",
    body: [
      "MR INDIA does not permit the purchase or shipment of edible products.",
      "This includes sweets, snacks, dairy products, short-expiry food, spices, condiments and restricted powders.",
      "Orders containing prohibited items may be cancelled or refused for shipment.",
    ],
  },

  {
    title: "Returns and refunds",
    body: [
      "All sales are final.",
      "MR INDIA does not accept returns or exchanges after payment has been completed.",
      "Customers are encouraged to select Product Verification where available.",
      "If a product is out of stock, the amount paid for the product and applicable shipping charges will be credited to the customer's MR INDIA Wallet.",
      "The service fee is non-refundable.",
      "Wallet refunds cannot be withdrawn as cash and may be used for future purchases on the MR INDIA Platform.",
    ],
  },

  {
    title: "Intellectual property",
    body: [
      "Content on the MR INDIA website, including text, graphics, logos and software, is protected by applicable intellectual property laws.",
      "Users must not copy, reproduce, distribute or modify protected content without prior written permission.",
    ],
  },

  {
    title: "User conduct",
    body: [
      "Users must use MR INDIA for lawful purposes.",
      "Users must not provide false or misleading information.",
      "Users must not access another person's account without permission.",
      "Users must not upload or transmit threatening, abusive or obscene material.",
    ],
  },

  {
    title: "Limitation of liability",
    body: [
      "MR INDIA, its affiliates, directors, employees and agents are not liable for indirect, incidental or consequential loss arising from use of the Platform or products purchased through MR INDIA.",
      "This includes loss of profits, data or goodwill.",
    ],
  },

  {
    title: "Privacy",
    body: [
      "MR INDIA respects the privacy of its customers.",
      "Customers should review the MR INDIA Privacy Policy for information about how personal information is collected, used and protected.",
    ],
  },

  {
    title: "Governing law",
    body: [
      "These Terms and Conditions are governed by the laws of Mauritius.",
      "Any disputes shall be subject to the jurisdiction of the courts of Mauritius.",
    ],
  },

  {
    title: "Modification of terms",
    body: [
      "MR INDIA may update or modify these Terms and Conditions at any time.",
      "Customers are responsible for reviewing the latest version available on the Platform.",
      "Continued use of MR INDIA after an update constitutes acceptance of the revised Terms and Conditions.",
    ],
  },

  {
    title: "Contact information",
    body: [
      "Email: info@mrindia.mu",
      "Purchasing Email: purchasing@mrindia.mu",
      "Phone: 59402105",
      "Address: Kathrada Building – Corner 21 Bourbon & Remy Ollier Street, Port Louis, Mauritius.",
    ],
  },
];

export default function Terms() {
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
        {/* Header containing back navigation and the legal-document icon. */}
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
              name="document-text-outline"
              size={24}
              color={COLORS.amber}
            />
          </View>
        </View>

        {/* Page heading and description of the legal content. */}
        <Text style={s.title}>Terms & Conditions</Text>

        <Text style={s.subtitle}>
          Full customer terms for using Mr India and placing orders.
        </Text>

        {/* Clearly display the date from which these terms apply. */}
        <View style={s.dateCard}>
          <Text style={s.dateLabel}>Effective from</Text>
          <Text style={s.dateValue}>October 2026</Text>
        </View>

        {/* Render every legal section and its individual terms. */}
        <View style={s.card}>
          {TERMS_SECTIONS.map((sec, i) => (
            <View
              key={i}
              style={[
                s.sectionBlock,
                i < TERMS_SECTIONS.length - 1 && s.sectionBorder,
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

        {/* Final reminder that continued use represents acceptance. */}
        <Text style={s.footerNote}>
          By continuing to use Mr India, you agree to these Terms and
          Conditions.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Create theme-aware styles for the terms and conditions screen.
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
      marginBottom: 18,
    },

    dateCard: {
      backgroundColor: COLORS.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      marginBottom: 18,
    },

    dateLabel: {
      color: COLORS.t3,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 4,
    },

    dateValue: {
      color: COLORS.amber,
      fontSize: 18,
      fontWeight: "900",
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




