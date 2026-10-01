// src/app/order-details.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, getColors } from "../lib/mrindia";

function paymentLabel(state?: string) {
  switch (String(state || "").toLowerCase()) {
    case "done":
      return "Confirmed";
    case "authorized":
      return "Authorized";
    case "pending":
      return "Pending";
    case "cancel":
    case "cancelled":
      return "Cancelled";
    case "error":
      return "Error";
    case "draft":
      return "Draft";
    default:
      return "Not available";
  }
}

function formatDate(value?: string) {
  if (!value) return "â€”";

  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );

  if (!match) return value;

  const [, month, day, year] = match;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthIndex = Number(month) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    return value;
  }

  return `${Number(day)} ${months[monthIndex]} ${year}`;
}

function itemTitle(item: any) {
  return (
    String(item?.item_name || "").trim() ||
    String(item?.original_url || "").trim() ||
    String(item?.product_name || "").trim() ||
    "Product"
  );
}

function itemUrl(item: any) {
  return (
    String(item?.original_url || "").trim() ||
    String(item?.order_url || "").trim()
  );
}

function formatBreakdownMoney(value: any, breakdown: any) {
  const amount = Number(value || 0);

  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const symbol = String(
    breakdown?.currency_symbol || breakdown?.currency || "",
  ).trim();

  return symbol ? `${symbol}${formatted}` : formatted;
}

function SummaryRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: any;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export default function OrderDetails() {
  const { orderId } = useLocalSearchParams<{
    orderId?: string;
  }>();

  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  const loadOrder = useCallback(
    async (showLoader = false) => {
      if (!orderId) {
        setError("Order not found.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        const result = await api.myMiOrder(Number(orderId));

        if (!result?.success) {
          if (showLoader) {
            setError(result?.message || "Unable to load order.");
          }
          return;
        }

        setError("");
        setOrder(result);
      } catch (err) {
        console.log("ORDER DETAILS ERROR:", err);

        // Don't remove already-loaded order data if a silent refresh fails.
        if (showLoader) {
          setError("Unable to load order details.");
        }
      } finally {
        if (showLoader) {
          setLoading(false);
        }

        setRefreshing(false);
      }
    },
    [orderId],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrder(false);
  }, [loadOrder]);

  useFocusEffect(
    useCallback(() => {
      loadOrder(true);
    }, [loadOrder]),
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.amber} />
          <Text style={s.loadingText}>Loading order...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={COLORS.amber}
          />

          <Text style={s.errorText}>{error || "Order not found."}</Text>

          <Pressable
            style={s.backButton}
            onPress={() => router.replace("/orders")}
          >
            <Text style={s.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const items = Array.isArray(order?.items) ? order.items : [];
  const payment = order?.payment || {};
  const breakdown = order?.payment_breakdown || {};

  const walletUsed = Number(breakdown?.wallet_used || 0);
  const promoDiscount = Number(breakdown?.promo_discount_total || 0);
  const externalPaymentAmount = Number(breakdown?.bank_transfer_amount || 0);

  // Rebuild the checkout subtotal using values already returned
  // by the existing order-details API.
  const orderSubtotal = externalPaymentAmount + walletUsed + promoDiscount;

  const fullyPaidWithWallet = Boolean(breakdown?.fully_paid_with_wallet);

  const paymentMethodLabel = fullyPaidWithWallet
    ? "Wallet"
    : payment?.method || (walletUsed > 0 ? "Wallet + external payment" : "â€”");

  const paymentStatusLabel = fullyPaidWithWallet
    ? "Confirmed"
    : paymentLabel(payment?.state);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Pressable style={s.backIcon} onPress={() => router.replace("/orders")}>
          <Ionicons name="arrow-back" size={21} color={COLORS.t1} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={s.title}>Order details</Text>
          <Text style={s.reference}>{order?.name || "â€”"}</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.amber]}
            tintColor={COLORS.amber}
          />
        }
      >
        <Text style={s.sectionTitle}>Items</Text>

        {items.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="cube-outline" size={30} color={COLORS.t3} />
            <Text style={s.emptyText}>
              Product details are unavailable for this order.
            </Text>
          </View>
        ) : (
          items.map((item: any) => {
            const title = itemTitle(item);
            const url = itemUrl(item);

            const verificationRequired =
              String(item?.verification_needed || "").toLowerCase() === "yes";

            const verificationStatus = String(
              item?.["verification_status "] || "",
            ).trim();

            return (
              <Pressable
                key={item.id}
                style={s.productCard}
                disabled={!url}
                onPress={() => {
                  if (!url) return;

                  router.push({
                    pathname: "/browser",
                    params: {
                      url,
                      name: title,
                    },
                  });
                }}
              >
                <Image
                  source={{ uri: item?.thumbNail }}
                  style={s.productImage}
                  resizeMode="cover"
                />

                <View style={s.productInfo}>
                  <Text style={s.productName} numberOfLines={3}>
                    {title}
                  </Text>

                  <Text style={s.productMeta}>
                    Quantity: {item?.qty || "â€”"}
                  </Text>

                  <Text style={s.productMeta}>
                    Status: {item?.trackingstatus || "â€”"}
                  </Text>

                  <Text style={s.productMeta}>
                    Verification:{" "}
                    {verificationRequired ? "Required" : "Not required"}
                  </Text>

                  {verificationRequired && verificationStatus ? (
                    <Text style={s.productMeta}>
                      Verification status: {verificationStatus}
                    </Text>
                  ) : null}

                  {!!item?.size && (
                    <Text style={s.productMeta}>Size: {String(item.size)}</Text>
                  )}

                  {!!item?.color && (
                    <Text style={s.productMeta}>
                      Color: {String(item.color)}
                    </Text>
                  )}

                  <Text style={s.productPrice}>
                    {item?.price_unit || "â€”"}
                  </Text>

                  {!!url && (
                    <Text style={s.productLinkHint}>Tap to view product</Text>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        <Text style={[s.sectionTitle, { marginTop: 22 }]}>
          Order information
        </Text>

        <View style={s.summaryCard}>
          <SummaryRow label="Reference" value={order?.name || "—"} styles={s} />

          <SummaryRow
            label="Date"
            value={formatDate(order?.create_date)}
            styles={s}
          />

          <SummaryRow
            label="Order status"
            value={order?.status || "—"}
            styles={s}
          />

          <SummaryRow
            label="Payment status"
            value={paymentStatusLabel}
            styles={s}
          />

          <SummaryRow
            label="Payment method"
            value={paymentMethodLabel}
            styles={s}
          />

          <SummaryRow
            label="Promo code used"
            value={
              breakdown?.promo_code ? String(breakdown.promo_code) : "None"
            }
            styles={s}
          />

          <SummaryRow
            label="Wallet amount used"
            value={
              walletUsed > 0
                ? formatBreakdownMoney(walletUsed, breakdown)
                : formatBreakdownMoney(0, breakdown)
            }
            styles={s}
          />
        </View>

        <Text style={[s.sectionTitle, { marginTop: 22 }]}>Payment summary</Text>

        <View style={s.summaryCard}>
          <SummaryRow
            label="Subtotal"
            value={formatBreakdownMoney(orderSubtotal, breakdown)}
            styles={s}
          />

          {promoDiscount > 0 && (
            <SummaryRow
              label="Promo discount"
              value={`-${formatBreakdownMoney(promoDiscount, breakdown)}`}
              styles={s}
            />
          )}

          {walletUsed > 0 && (
            <SummaryRow
              label="Wallet deduction"
              value={`-${formatBreakdownMoney(walletUsed, breakdown)}`}
              styles={s}
            />
          )}

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Amount due</Text>

            <Text style={s.totalValue}>
              {fullyPaidWithWallet
                ? formatBreakdownMoney(0, breakdown)
                : formatBreakdownMoney(externalPaymentAmount, breakdown)}
            </Text>
          </View>
        </View>

        <Text style={[s.sectionTitle, { marginTop: 22 }]}>Item status</Text>

        {items.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>
              No item tracking information available.
            </Text>
          </View>
        ) : (
          items.map((item: any) => (
            <View key={`tracking-${item.id}`} style={s.statusCard}>
              <View style={s.statusIcon}>
                <Ionicons name="cube-outline" size={18} color={COLORS.amber} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.statusName} numberOfLines={1}>
                  {itemTitle(item)}
                </Text>

                <Text style={s.statusText}>
                  {item?.trackingstatus || "â€”"}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.bg,
    },

    backIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      alignItems: "center",
      justifyContent: "center",
    },

    title: {
      color: COLORS.t1,
      fontSize: 21,
      fontWeight: "900",
    },

    reference: {
      color: COLORS.amber,
      fontSize: 12,
      fontWeight: "900",
      marginTop: 2,
    },

    scroll: {
      flex: 1,
    },

    content: {
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 80,
    },

    sectionTitle: {
      color: COLORS.t1,
      fontSize: 18,
      fontWeight: "900",
      marginBottom: 12,
    },

    productCard: {
      flexDirection: "row",
      backgroundColor: COLORS.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 11,
      gap: 12,
      marginBottom: 11,
    },

    productImage: {
      width: 88,
      height: 88,
      borderRadius: 14,
      backgroundColor: COLORS.bg2,
    },

    productInfo: {
      flex: 1,
      justifyContent: "center",
    },

    productName: {
      color: COLORS.t1,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 20,
    },

    productMeta: {
      color: COLORS.t2,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
    },

    productLinkHint: {
      color: COLORS.amber,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 6,
    },

    productPrice: {
      color: COLORS.amber,
      fontSize: 15,
      fontWeight: "900",
      marginTop: 7,
    },

    summaryCard: {
      backgroundColor: COLORS.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
    },

    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },

    summaryLabel: {
      color: COLORS.t2,
      fontSize: 12,
      fontWeight: "600",
    },

    summaryValue: {
      flex: 1,
      color: COLORS.t1,
      fontSize: 12,
      fontWeight: "900",
      textAlign: "right",
    },

    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 15,
    },

    totalLabel: {
      color: COLORS.t1,
      fontSize: 16,
      fontWeight: "900",
    },

    totalValue: {
      color: COLORS.amber,
      fontSize: 19,
      fontWeight: "900",
    },

    statusCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: COLORS.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 12,
      marginBottom: 9,
    },

    statusIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: COLORS.bg2,
      alignItems: "center",
      justifyContent: "center",
    },

    statusName: {
      color: COLORS.t1,
      fontSize: 13,
      fontWeight: "800",
    },

    statusText: {
      color: COLORS.amber,
      fontSize: 13,
      fontWeight: "900",
      marginTop: 3,
    },

    emptyCard: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 22,
      alignItems: "center",
    },

    emptyText: {
      color: COLORS.t2,
      fontSize: 12,
      fontWeight: "500",
      textAlign: "center",
      marginTop: 8,
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 30,
    },

    loadingText: {
      color: COLORS.t2,
      fontSize: 13,
      fontWeight: "500",
      marginTop: 12,
    },

    errorText: {
      color: COLORS.t2,
      textAlign: "center",
      marginTop: 12,
    },

    backButton: {
      backgroundColor: COLORS.amber,
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 11,
      marginTop: 18,
    },

    backButtonText: {
      color: "#FFFFFF",
      fontWeight: "900",
    },
  });
