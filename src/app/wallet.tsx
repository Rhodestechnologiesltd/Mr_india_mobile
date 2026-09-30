// src/app/wallet.tsx

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, getColors, useStore } from "../lib/mrindia";

/* -------------------------------------------------------------------------- */
/*                                Helper logic                                */
/* -------------------------------------------------------------------------- */

/**
 * Get the transaction type shown to the customer.
 *
 * We keep Credit / Debit separate from the transaction reason.
 */
function getTransactionType(transaction: any) {
  const type = String(transaction?.wallet_type || "").toLowerCase();

  if (type === "credit") {
    return "Credit";
  }

  if (type === "debit") {
    return "Debit";
  }

  return (
    transaction?.wallet_type_label || transaction?.wallet_type || "Transaction"
  );
}

/**
 * Determine the customer-friendly reason for a wallet transaction.
 *
 * IMPORTANT:
 * For accurate reasons such as "Out of stock", "Promotion", etc.,
 * the backend should ideally return one of:
 *
 * reason
 * reason_code
 * reason_label
 * transaction_reason
 *
 * The fallbacks below prevent the UI from breaking when older wallet
 * transactions do not yet contain those fields.
 */
function getTransactionReason(transaction: any) {
  const rawReason = String(
    transaction?.reason_code ||
      transaction?.reason ||
      transaction?.transaction_reason ||
      transaction?.reason_label ||
      "",
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  switch (rawReason) {
    case "out_of_stock":
    case "outofstock":
      return "Out of stock";

    case "cannot_be_purchased":
    case "cannot_purchase":
    case "cannot_be_bought":
    case "unable_to_purchase":
      return "Cannot be purchased";

    case "promotion":
    case "promo":
    case "promotional_credit":
    case "promotion_credit":
      return "Promotion";

    case "order_payment":
    case "wallet_payment":
    case "payment":
      return "Order payment";

    case "refund":
    case "order_refund":
      return "Refund";

    case "manual_credit":
      return "Manual credit";

    case "manual_debit":
      return "Manual debit";
  }

  // If Odoo already sends a readable reason label, use it.
  if (transaction?.reason_label) {
    return String(transaction.reason_label);
  }

  /**
   * Fallback behaviour for older transactions.
   *
   * Debit connected to a sale order is most likely wallet money
   * applied to that order.
   */
  if (
    String(transaction?.wallet_type || "").toLowerCase() === "debit" &&
    transaction?.sale_order
  ) {
    return "Order payment";
  }

  /**
   * Do NOT automatically call every manual credit a Promotion.
   *
   * A future backend reason should determine whether it was:
   * Promotion / Refund / Adjustment / etc.
   */
  if (
    String(transaction?.wallet_type || "").toLowerCase() === "credit" &&
    !transaction?.sale_order
  ) {
    return "Manual credit";
  }

  return "Wallet transaction";
}

/**
 * Get the sale/order/reference displayed for the transaction.
 */
function getTransactionReference(transaction: any) {
  return (
    transaction?.sale_order ||
    transaction?.order_name ||
    transaction?.order_reference ||
    transaction?.reference_label ||
    transaction?.reference ||
    ""
  );
}

/**
 * Convert different possible backend dates into a customer-friendly format.
 */
function formatTransactionDate(value?: string) {
  if (!value) {
    return "";
  }

  const raw = String(value).trim();

  /**
   * Odoo-style:
   * 09/17/2026 10:42:19
   */
  const odooMatch = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/,
  );

  if (odooMatch) {
    const [, month, day, year] = odooMatch;

    const date = new Date(Number(year), Number(month) - 1, Number(day));

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  }

  /**
   * ISO / JavaScript-readable dates.
   */
  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return raw;
}

/**
 * Try several names because different Odoo/custom API implementations
 * may expose the date using different keys.
 */
function getTransactionDate(transaction: any) {
  return formatTransactionDate(
    transaction?.date ||
      transaction?.create_date ||
      transaction?.created_at ||
      transaction?.transaction_date ||
      transaction?.date_created ||
      "",
  );
}

/**
 * Convert an unknown field value to a usable number.
 *
 * Returns null when the backend did not provide a valid value.
 */
function optionalNumber(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Refund detail fields.
 *
 * These are intentionally flexible so the frontend can support several
 * sensible backend field names without crashing.
 *
 * We only display rows when Odoo actually provides the amount.
 */
function getRefundBreakdown(transaction: any) {
  const product = optionalNumber(
    transaction?.product_refund,
    transaction?.product_refund_amount,
    transaction?.refund_product,
    transaction?.refund_product_amount,
    transaction?.product_amount,
  );

  const shipping = optionalNumber(
    transaction?.shipping_refund,
    transaction?.shipping_refund_amount,
    transaction?.refund_shipping,
    transaction?.refund_shipping_amount,
    transaction?.shipping_amount,
  );

  const verification = optionalNumber(
    transaction?.verification_refund,
    transaction?.verification_refund_amount,
    transaction?.refund_verification,
    transaction?.refund_verification_amount,
    transaction?.verification_amount,
  );

  return {
    product,
    shipping,
    verification,
  };
}

/**
 * Decide whether the transaction represents a refund where a breakdown
 * would be useful.
 */
function isRefundTransaction(transaction: any) {
  const reason = getTransactionReason(transaction).toLowerCase();

  return (
    reason === "out of stock" ||
    reason === "cannot be purchased" ||
    reason === "refund"
  );
}

/* -------------------------------------------------------------------------- */
/*                          Reusable modal detail row                         */
/* -------------------------------------------------------------------------- */

function DetailRow({
  label,
  value,
  styles,
  bold = false,
  accent = false,
}: {
  label: string;
  value: string;
  styles: any;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, bold && styles.detailLabelBold]}>
        {label}
      </Text>

      <Text
        style={[
          styles.detailValue,
          bold && styles.detailValueBold,
          accent && styles.detailValueAccent,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Wallet screen                                */
/* -------------------------------------------------------------------------- */

export default function Wallet() {
  const router = useRouter();

  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);

  const { user } = useStore();

  const [wallet, setWallet] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  /**
   * Transaction selected by the customer.
   *
   * When this contains a transaction, the detail popup becomes visible.
   */
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(
    null,
  );

  /* ------------------------------------------------------------------------ */
  /*                              Load Odoo wallet                            */
  /* ------------------------------------------------------------------------ */

  const loadWallet = useCallback(
    async (refresh = false) => {
      if (!user) {
        setWallet(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        console.log("========== LOAD ODOO WALLET ==========");

        const result = await api.myWallet();

        console.log("ODOO WALLET RESULT:", JSON.stringify(result, null, 2));

        if (!result?.success) {
          throw new Error(result?.message || "Could not load wallet.");
        }

        setWallet(result?.wallet ?? null);
      } catch (err: any) {
        console.log("ODOO WALLET ERROR:", err);

        setError(
          err?.message || "We couldn't load your wallet. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet]),
  );

  /* ------------------------------------------------------------------------ */
  /*                               Money format                               */
  /* ------------------------------------------------------------------------ */

  const currencySymbol = wallet?.currency_symbol || "";
  const currencyName = wallet?.currency || "";

  const formatAmount = (value: any) => {
    const number = Number(value || 0);

    return `${currencySymbol}${number.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const transactions = Array.isArray(wallet?.transactions)
    ? wallet.transactions
    : [];

  /* ------------------------------------------------------------------------ */
  /*                       Selected transaction details                       */
  /* ------------------------------------------------------------------------ */

  const selectedIsCredit =
    String(selectedTransaction?.wallet_type || "").toLowerCase() === "credit";

  const selectedType = selectedTransaction
    ? getTransactionType(selectedTransaction)
    : "";

  const selectedReason = selectedTransaction
    ? getTransactionReason(selectedTransaction)
    : "";

  const selectedReference = selectedTransaction
    ? getTransactionReference(selectedTransaction)
    : "";

  const selectedDate = selectedTransaction
    ? getTransactionDate(selectedTransaction)
    : "";

  const selectedRefund = selectedTransaction
    ? getRefundBreakdown(selectedTransaction)
    : {
        product: null,
        shipping: null,
        verification: null,
      };

  const selectedHasRefundBreakdown =
    selectedRefund.product !== null ||
    selectedRefund.shipping !== null ||
    selectedRefund.verification !== null;

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.replace("/account")}
          style={s.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={25} color={COLORS.t1} />
        </TouchableOpacity>

        <View style={s.headerText}>
          <Text style={s.title}>My Wallet</Text>

          <Text style={s.subtitle}>
            Your Mr India wallet balance and activity
          </Text>
        </View>
      </View>

      {/* Loading */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.amber} />

          <Text style={s.loadingText}>Loading your wallet...</Text>
        </View>
      ) : error ? (
        /* Error */
        <View style={s.center}>
          <View style={s.errorIcon}>
            <Ionicons name="wallet-outline" size={34} color={COLORS.amber} />
          </View>

          <Text style={s.errorTitle}>Couldn't load your wallet</Text>

          <Text style={s.errorText}>{error}</Text>

          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => loadWallet()}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />

            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Main wallet */
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadWallet(true)}
              colors={[COLORS.amber]}
              tintColor={COLORS.amber}
            />
          }
        >
          {/* Balance */}
          <View style={s.balanceCard}>
            <View style={s.balanceTop}>
              <View>
                <Text style={s.balanceLabel}>Available balance</Text>

                <Text style={s.balance}>{formatAmount(wallet?.balance)}</Text>

                {!!currencyName && (
                  <Text style={s.currency}>{currencyName}</Text>
                )}
              </View>

              <View style={s.walletIcon}>
                <Ionicons name="wallet" size={28} color={COLORS.amber} />
              </View>
            </View>
          </View>

          {/* Wallet activity heading */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Wallet activity</Text>

            <Text style={s.count}>
              {wallet?.transaction_count ?? transactions.length}
            </Text>
          </View>

          {/* No transactions */}
          {transactions.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}>
                <Ionicons
                  name="receipt-outline"
                  size={30}
                  color={COLORS.amber}
                />
              </View>

              <Text style={s.emptyTitle}>No wallet activity yet</Text>

              <Text style={s.emptyText}>
                Your wallet transactions will appear here.
              </Text>
            </View>
          ) : (
            /* Transactions */
            <View style={s.transactionList}>
              {transactions.map((transaction: any, index: number) => {
                const isCredit =
                  String(transaction?.wallet_type || "").toLowerCase() ===
                  "credit";

                const type = getTransactionType(transaction);

                const reason = getTransactionReason(transaction);

                const reference = getTransactionReference(transaction);

                const date = getTransactionDate(transaction);

                return (
                  <TouchableOpacity
                    key={String(transaction.id)}
                    style={[
                      s.transaction,

                      index === transactions.length - 1 && s.transactionLast,
                    ]}
                    activeOpacity={0.72}
                    onPress={() => setSelectedTransaction(transaction)}
                  >
                    {/* Icon */}
                    <View style={s.transactionIcon}>
                      <Ionicons
                        name={
                          isCredit ? "arrow-down-outline" : "arrow-up-outline"
                        }
                        size={20}
                        color={COLORS.amber}
                      />
                    </View>

                    {/* Information */}
                    <View style={s.transactionInfo}>
                      {/* Credit / Debit */}
                      <Text style={s.transactionType}>{type}</Text>

                      {/* Reason */}
                      <Text style={s.transactionTitle} numberOfLines={1}>
                        {reason}
                      </Text>

                      {/* Order / date */}
                      {(reference || date) && (
                        <Text style={s.transactionMeta} numberOfLines={1}>
                          {reference}

                          {reference && date ? " • " : ""}

                          {date}
                        </Text>
                      )}

                      {!!transaction.status_label && (
                        <Text style={s.transactionStatus}>
                          {transaction.status_label}
                        </Text>
                      )}
                    </View>

                    {/* Amount + chevron */}
                    <View style={s.transactionRight}>
                      <Text
                        style={[
                          s.transactionAmount,
                          isCredit && s.transactionCreditAmount,
                        ]}
                      >
                        {isCredit ? "+" : "-"}
                        {formatAmount(transaction.amount)}
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={COLORS.t3}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={s.tapHint}>Tap a transaction to view its details.</Text>
        </ScrollView>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*                    Transaction details popup                       */}
      {/* ------------------------------------------------------------------ */}

      <Modal
        visible={!!selectedTransaction}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <View style={s.modalOverlay}>
          {/* Tap outside popup to close */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedTransaction(null)}
          />

          {/* Popup card */}
          <View style={s.modalCard}>
            {/* Popup heading */}
            <View style={s.modalTop}>
              <View
                style={[
                  s.modalTypeIcon,

                  selectedIsCredit ? s.modalCreditIcon : s.modalDebitIcon,
                ]}
              >
                <Ionicons
                  name={
                    selectedIsCredit ? "arrow-down-outline" : "arrow-up-outline"
                  }
                  size={22}
                  color={COLORS.amber}
                />
              </View>

              <View style={s.modalHeading}>
                {/* CREDIT / DEBIT */}
                <Text style={s.modalType}>{selectedType}</Text>

                {/* Reason */}
                <Text style={s.modalReason}>{selectedReason}</Text>
              </View>

              {/* Close */}
              <TouchableOpacity
                style={s.modalClose}
                onPress={() => setSelectedTransaction(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={COLORS.t1} />
              </TouchableOpacity>
            </View>

            {/* Order + date */}
            {(selectedReference || selectedDate) && (
              <View style={s.modalMetaCard}>
                {!!selectedReference && (
                  <View style={s.modalMetaItem}>
                    <Text style={s.modalMetaLabel}>Order</Text>

                    <Text style={s.modalMetaValue}>{selectedReference}</Text>
                  </View>
                )}

                {!!selectedReference && !!selectedDate && (
                  <View style={s.modalMetaDivider} />
                )}

                {!!selectedDate && (
                  <View style={s.modalMetaItem}>
                    <Text style={s.modalMetaLabel}>Date</Text>

                    <Text style={s.modalMetaValue}>{selectedDate}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ------------------------------------------------------------ */}
            {/* Refund breakdown                                             */}
            {/* ------------------------------------------------------------ */}

            {selectedTransaction &&
            isRefundTransaction(selectedTransaction) &&
            selectedHasRefundBreakdown ? (
              <>
                <Text style={s.modalSectionTitle}>Refund details</Text>

                <View style={s.detailBox}>
                  {selectedRefund.product !== null && (
                    <DetailRow
                      label="Product"
                      value={formatAmount(selectedRefund.product)}
                      styles={s}
                    />
                  )}

                  {selectedRefund.shipping !== null && (
                    <DetailRow
                      label="Shipping"
                      value={formatAmount(selectedRefund.shipping)}
                      styles={s}
                    />
                  )}

                  {selectedRefund.verification !== null && (
                    <DetailRow
                      label="Verification"
                      value={formatAmount(selectedRefund.verification)}
                      styles={s}
                    />
                  )}

                  <View style={s.detailDivider} />

                  <DetailRow
                    label="Total credited"
                    value={`+${formatAmount(selectedTransaction?.amount)}`}
                    styles={s}
                    bold
                    accent
                  />
                </View>
              </>
            ) : (
              /* Normal wallet transaction */
              <>
                <Text style={s.modalSectionTitle}>Transaction details</Text>

                <View style={s.detailBox}>
                  <DetailRow
                    label={
                      selectedIsCredit ? "Amount credited" : "Amount debited"
                    }
                    value={`${selectedIsCredit ? "+" : "-"}${formatAmount(
                      selectedTransaction?.amount,
                    )}`}
                    styles={s}
                    bold
                    accent
                  />
                </View>
              </>
            )}

            {/* Status */}
            {!!selectedTransaction?.status_label && (
              <View style={s.modalStatusBox}>
                <View>
                  <Text style={s.modalStatusLabel}>Status</Text>

                  <Text style={s.modalStatusValue}>
                    {selectedTransaction.status_label}
                  </Text>
                </View>

                <View style={s.statusCheck}>
                  <Ionicons name="checkmark" size={17} color={COLORS.amber} />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Styles                                  */
/* -------------------------------------------------------------------------- */

function makeStyles(COLORS: any) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },

    /* Header */

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 16,
    },

    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.card,
      marginRight: 12,
    },

    headerText: {
      flex: 1,
    },

    title: {
      fontSize: 24,
      fontWeight: "800",
      color: COLORS.t1,
    },

    subtitle: {
      marginTop: 3,
      fontSize: 12,
      color: COLORS.t2,
    },

    /* Content */

    content: {
      paddingHorizontal: 18,
      paddingBottom: 40,
    },

    center: {
      flex: 1,
      paddingHorizontal: 30,
      alignItems: "center",
      justifyContent: "center",
    },

    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: COLORS.t2,
    },

    /* Error */

    errorIcon: {
      width: 66,
      height: 66,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.card,
      marginBottom: 16,
    },

    errorTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: COLORS.t1,
      textAlign: "center",
    },

    errorText: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 19,
      color: COLORS.t2,
      textAlign: "center",
    },

    retryBtn: {
      marginTop: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 20,
      height: 46,
      borderRadius: 14,
      backgroundColor: COLORS.amber,
    },

    retryText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },

    /* Balance */

    balanceCard: {
      padding: 20,
      borderRadius: 22,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.line,
    },

    balanceTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    balanceLabel: {
      fontSize: 13,
      color: COLORS.t2,
      marginBottom: 8,
    },

    balance: {
      fontSize: 30,
      fontWeight: "900",
      color: COLORS.t1,
    },

    currency: {
      marginTop: 5,
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.t2,
    },

    walletIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.bg,
    },

    /* Section */

    sectionHeader: {
      marginTop: 28,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: COLORS.t1,
    },

    count: {
      minWidth: 28,
      height: 28,
      paddingHorizontal: 8,
      borderRadius: 14,
      textAlign: "center",
      textAlignVertical: "center",
      fontSize: 12,
      fontWeight: "800",
      color: COLORS.amber,
      backgroundColor: COLORS.card,
    },

    /* Empty */

    emptyCard: {
      alignItems: "center",
      paddingVertical: 38,
      paddingHorizontal: 20,
      borderRadius: 20,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.line,
    },

    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.bg,
      marginBottom: 14,
    },

    emptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: COLORS.t1,
    },

    emptyText: {
      marginTop: 6,
      fontSize: 12,
      color: COLORS.t2,
      textAlign: "center",
    },

    /* Transaction list */

    transactionList: {
      overflow: "hidden",
      borderRadius: 20,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.line,
    },

    transaction: {
      minHeight: 94,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.line,
    },

    transactionLast: {
      borderBottomWidth: 0,
    },

    transactionIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.bg,
      marginRight: 12,
    },

    transactionInfo: {
      flex: 1,
      paddingRight: 8,
    },

    /**
     * Credit / Debit
     */
    transactionType: {
      fontSize: 10,
      fontWeight: "900",
      color: COLORS.amber,
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },

    /**
     * Reason
     */
    transactionTitle: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: "800",
      color: COLORS.t1,
    },

    transactionMeta: {
      marginTop: 3,
      fontSize: 11,
      color: COLORS.t2,
    },

    transactionStatus: {
      marginTop: 3,
      fontSize: 10,
      fontWeight: "700",
      color: COLORS.t2,
    },

    transactionRight: {
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 7,
    },

    transactionAmount: {
      fontSize: 14,
      fontWeight: "900",
      color: COLORS.t1,
    },

    transactionCreditAmount: {
      color: COLORS.t1,
    },

    tapHint: {
      marginTop: 12,
      fontSize: 11,
      textAlign: "center",
      color: COLORS.t3,
    },

    /* -------------------------------------------------------------------- */
    /* Modal                                                                */
    /* -------------------------------------------------------------------- */

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.48)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: 30,
    },

    modalCard: {
      width: "100%",
      maxWidth: 430,
      backgroundColor: COLORS.card,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: COLORS.line,
      padding: 20,
    },

    modalTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    modalTypeIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    modalCreditIcon: {
      backgroundColor:
        COLORS.bg === "#131F2A"
          ? "rgba(255,122,5,0.14)"
          : "rgba(255,122,5,0.09)",
    },

    modalDebitIcon: {
      backgroundColor:
        COLORS.bg === "#131F2A"
          ? "rgba(255,122,5,0.14)"
          : "rgba(255,122,5,0.09)",
    },

    modalHeading: {
      flex: 1,
    },

    modalType: {
      color: COLORS.amber,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.9,
    },

    modalReason: {
      color: COLORS.t1,
      fontSize: 21,
      fontWeight: "900",
      marginTop: 3,
    },

    modalClose: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: COLORS.bg,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },

    /* Order / date */

    modalMetaCard: {
      flexDirection: "row",
      alignItems: "stretch",
      marginTop: 20,
      backgroundColor: COLORS.bg,
      borderRadius: 16,
      paddingVertical: 13,
      paddingHorizontal: 15,
    },

    modalMetaItem: {
      flex: 1,
    },

    modalMetaDivider: {
      width: 1,
      backgroundColor: COLORS.line,
      marginHorizontal: 14,
    },

    modalMetaLabel: {
      color: COLORS.t3,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    modalMetaValue: {
      color: COLORS.t1,
      fontSize: 13,
      fontWeight: "900",
      marginTop: 4,
    },

    /* Refund / transaction details */

    modalSectionTitle: {
      color: COLORS.t1,
      fontSize: 15,
      fontWeight: "900",
      marginTop: 22,
      marginBottom: 10,
    },

    detailBox: {
      backgroundColor: COLORS.bg,
      borderRadius: 17,
      paddingHorizontal: 15,
      paddingVertical: 5,
    },

    detailRow: {
      minHeight: 43,
      paddingVertical: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
    },

    detailLabel: {
      flex: 1,
      color: COLORS.t2,
      fontSize: 13,
    },

    detailLabelBold: {
      color: COLORS.t1,
      fontWeight: "900",
    },

    detailValue: {
      color: COLORS.t1,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "right",
    },

    detailValueBold: {
      fontWeight: "900",
      fontSize: 15,
    },

    detailValueAccent: {
      color: COLORS.amber,
    },

    detailDivider: {
      height: 1,
      backgroundColor: COLORS.line,
    },

    /* Status */

    modalStatusBox: {
      marginTop: 14,
      paddingHorizontal: 15,
      paddingVertical: 13,
      backgroundColor: COLORS.bg,
      borderRadius: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    modalStatusLabel: {
      color: COLORS.t3,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    modalStatusValue: {
      marginTop: 3,
      color: COLORS.t1,
      fontSize: 13,
      fontWeight: "900",
    },

    statusCheck: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        COLORS.bg === "#131F2A"
          ? "rgba(255,122,5,0.14)"
          : "rgba(255,122,5,0.09)",
    },
  });
}
