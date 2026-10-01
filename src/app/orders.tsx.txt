// src/app/orders.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, getColors, useStore } from "../lib/mrindia";

function formatDate(value?: string) {
  if (!value) return "Date unavailable";

  // Odoo returns MM/DD/YYYY HH:mm:ss
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

function getPaymentLabel(state?: string) {
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

function getItemCount(items: any[]) {
  return items.reduce((total, item) => {
    const quantity = parseFloat(String(item?.qty || "0"));

    return total + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
}

export default function Orders() {
  const { justOrdered } = useLocalSearchParams<{
    justOrdered?: string;
  }>();

  const { user } = useStore();

  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);

  const [orders, setOrders] = useState<any[] | null>(null);

  /*
   * Reload whenever this screen receives focus.
   *
   * This means:
   * Checkout -> Pay -> Orders
   * automatically fetches the newest Sales Order from Odoo.
   *
   * No emulator refresh is needed.
   */
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setOrders([]);
        return;
      }

      loadOrders();
    }, [user]),
  );

  async function loadOrders() {
    try {
      setOrders(null);

      console.log("========== LOAD ODOO ORDERS ==========");

      const result = await api.myOrders();

      const orderList =
        result?.recentOrders ??
        result?.orders ??
        result?.data ??
        result?.items ??
        [];

      if (!Array.isArray(orderList)) {
        setOrders([]);
        return;
      }

      /*
       * Load detail information for every Sales Order.
       *
       * Detail endpoint gives us:
       * - payment transaction
       * - actual purchased products
       * - quantities
       * - product status
       */
      const detailedOrders = await Promise.all(
        orderList.map(async (order: any) => {
          try {
            const detail = await api.myMiOrder(order.id);

            return {
              ...order,
              detail,
            };
          } catch (error) {
            console.log(
              `ORDER DETAIL ERROR ${order?.name || order?.id}:`,
              error,
            );

            return {
              ...order,
              detail: null,
            };
          }
        }),
      );

      setOrders(detailedOrders);
    } catch (error) {
      console.log("ODOO ORDERS ERROR:", error);
      setOrders([]);
    }
  }

  function openOrder(orderId: number) {
    router.push({
      pathname: "/order-details",
      params: {
        orderId: String(orderId),
      },
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Orders</Text>

            <Text style={s.subtitle}>Track your Mr India purchases</Text>
          </View>

          <View style={s.headerIcon}>
            <Ionicons name="cube-outline" size={22} color={COLORS.amber} />
          </View>
        </View>

        {/* Successful checkout message */}
        {justOrdered ? (
          <View style={s.successCard}>
            <View style={s.successIcon}>
              <Ionicons name="checkmark" size={23} color={COLORS.card} />
            </View>

            <View style={s.successContent}>
              <Text style={s.successTitle}>Order confirmed!</Text>

              <Text style={s.successRef}>{justOrdered}</Text>

              <Text style={s.successText}>
                Your order has been created successfully.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Loading */}
        {orders === null ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={COLORS.amber} />

            <Text style={s.loadingText}>Loading your orders...</Text>
          </View>
        ) : orders.length === 0 ? (
          /* Empty state */
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="cube-outline" size={38} color={COLORS.amber} />
            </View>

            <Text style={s.emptyTitle}>No orders yet</Text>

            <Text style={s.emptyText}>
              Your completed Mr India orders will appear here.
            </Text>
          </View>
        ) : (
          /* One card = one Odoo Sales Order */
          orders.map((order) => {
            const detail = order?.detail || {};

            const items = Array.isArray(detail?.items) ? detail.items : [];

            const payment = detail?.payment || {};

            const paymentState = String(payment?.state || "").toLowerCase();

            const paymentBreakdown = detail?.payment_breakdown || {};

            const fullyPaidWithWallet = Boolean(
              paymentBreakdown?.fully_paid_with_wallet,
            );

            const paymentLabel = fullyPaidWithWallet
              ? "Confirmed"
              : getPaymentLabel(paymentState);

            const itemCount = getItemCount(items);

            const paymentConfirmed =
              fullyPaidWithWallet ||
              paymentState === "done" ||
              paymentState === "authorized";

            const paymentCancelled =
              paymentState === "cancel" ||
              paymentState === "cancelled" ||
              paymentState === "error";

            const orderCancelled = String(order?.status || "")
              .toLowerCase()
              .includes("cancel");

            return (
              <Pressable
                key={order.id}
                onPress={() => openOrder(order.id)}
                style={({ pressed }) => [s.card, pressed && s.cardPressed]}
              >
                {/* Reference + total */}
                <View style={s.cardTop}>
                  <View style={s.cardTitleArea}>
                    <Text style={s.reference}>
                      {order.name || `Order #${order.id}`}
                    </Text>

                    <Text style={s.date}>{formatDate(order.create_date)}</Text>
                  </View>

                  <Text style={s.amount}>{order.amount_total || "—"}</Text>
                </View>

                <View style={s.separator} />

                {/* Items */}
                <View style={s.row}>
                  <Text style={s.label}>Items</Text>

                  <Text style={s.value}>
                    {items.length > 0
                      ? `${itemCount} ${itemCount === 1 ? "item" : "items"}`
                      : detail?.isOrderInvoiced
                        ? "View details"
                        : "0 items"}
                  </Text>
                </View>

                {/* Payment */}
                <View style={s.row}>
                  <Text style={s.label}>Payment</Text>

                  <View style={s.badge}>
                    <Ionicons
                      name={
                        paymentConfirmed
                          ? "checkmark-circle"
                          : paymentCancelled
                            ? "close-circle"
                            : "time-outline"
                      }
                      size={14}
                      color={
                        paymentConfirmed
                          ? COLORS.teal
                          : paymentCancelled
                            ? COLORS.rose
                            : COLORS.amber
                      }
                    />

                    <Text
                      style={[
                        s.badgeText,
                        {
                          color: paymentConfirmed
                            ? COLORS.teal
                            : paymentCancelled
                              ? COLORS.rose
                              : COLORS.amber,
                        },
                      ]}
                    >
                      {paymentLabel}
                    </Text>
                  </View>
                </View>

                {/* Odoo Sales Order state */}
                <View style={s.row}>
                  <Text style={s.label}>Order status</Text>

                  <Text
                    style={[
                      s.orderStatus,
                      {
                        color: orderCancelled ? COLORS.rose : COLORS.teal,
                      },
                    ]}
                  >
                    {order.status || "—"}
                  </Text>
                </View>

                {/* Visual navigation hint - whole card is clickable */}
                <View style={s.detailsHint}>
                  <Text style={s.detailsHintText}>View order details</Text>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.amber}
                  />
                </View>
              </Pressable>
            );
          })
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

    scroll: {
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
      marginBottom: 18,
    },

    title: {
      color: COLORS.t1,
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: -1,
    },

    subtitle: {
      color: COLORS.t2,
      fontSize: 13,
      marginTop: 3,
      fontWeight: "600",
    },

    headerIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      alignItems: "center",
      justifyContent: "center",
    },

    successCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: COLORS.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 15,
      marginBottom: 18,
    },

    successIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor: COLORS.amber,
      alignItems: "center",
      justifyContent: "center",
    },

    successContent: {
      flex: 1,
    },

    successTitle: {
      color: COLORS.t1,
      fontSize: 18,
      fontWeight: "900",
    },

    successRef: {
      color: COLORS.amber,
      fontSize: 13,
      fontWeight: "900",
      marginTop: 2,
    },

    successText: {
      color: COLORS.t2,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 5,
      fontWeight: "500",
    },

    loading: {
      alignItems: "center",
      paddingVertical: 70,
    },

    loadingText: {
      color: COLORS.t2,
      fontSize: 13,
      marginTop: 12,
      fontWeight: "600",
    },

    empty: {
      alignItems: "center",
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 22,
      padding: 30,
      marginTop: 30,
    },

    emptyIcon: {
      width: 70,
      height: 70,
      borderRadius: 22,
      backgroundColor: COLORS.bg2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },

    emptyTitle: {
      color: COLORS.t1,
      fontSize: 19,
      fontWeight: "900",
    },

    emptyText: {
      color: COLORS.t2,
      fontSize: 13,
      marginTop: 6,
      textAlign: "center",
      lineHeight: 19,
      fontWeight: "500",
    },

    card: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      marginBottom: 14,
    },

    cardPressed: {
      opacity: 0.88,
    },

    cardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },

    cardTitleArea: {
      flex: 1,
    },

    reference: {
      color: COLORS.amber,
      fontSize: 17,
      fontWeight: "900",
    },

    date: {
      color: COLORS.t2,
      fontSize: 12,
      marginTop: 4,
      fontWeight: "600",
    },

    amount: {
      color: COLORS.t1,
      fontSize: 16,
      fontWeight: "900",
    },

    separator: {
      height: 1,
      backgroundColor: COLORS.border,
      marginVertical: 14,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 36,
      gap: 12,
    },

    label: {
      color: COLORS.t2,
      fontSize: 13,
      fontWeight: "600",
    },

    value: {
      color: COLORS.t1,
      fontSize: 13,
      fontWeight: "800",
    },

    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: COLORS.bg2,
    },

    badgeText: {
      fontSize: 11,
      fontWeight: "900",
    },

    orderStatus: {
      fontSize: 12,
      fontWeight: "900",
    },

    detailsHint: {
      marginTop: 12,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    detailsHintText: {
      color: COLORS.amber,
      fontSize: 13,
      fontWeight: "900",
    },
  });
