//  src/app/addresses.tsx — saved delivery and billing addresses.
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { encode as base64Encode } from "base-64";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, getColors, GRAD, useStore } from "../lib/mrindia";

type Address = {
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
};

const EMPTY_ADDRESS: Address = {
  fullName: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  country: "Mauritius",
};

function getAddressKey(user: any) {
  const userIdentifier =
    user?.customerId || user?.id || user?.email?.toLowerCase();

  if (!userIdentifier) {
    return null;
  }

  return `mi_address_${userIdentifier}`;
}

function getValue(field: any) {
  if (field && typeof field === "object") {
    return String(field.value ?? "").trim();
  }

  return String(field ?? "").trim();
}

function normalizePhone(value: string) {
  return String(value || "")
    .replace(/\+230/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export default function Addresses() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    setup?: string;
  }>();

  const isSetup = params.setup === "1";

  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");
  const s = makeStyles(COLORS);

  const { user } = useStore();

  const [address, setAddress] = useState<Address | null>(null);
  const [editing, setEditing] = useState<Address>(EMPTY_ADDRESS);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadAddress() {
        try {
          if (!user) {
            if (active) {
              setAddress(null);
              setShowForm(false);
            }

            return;
          }

          const storageKey = getAddressKey(user);

          if (!storageKey) {
            console.log("Could not determine customer address key.");
            return;
          }

          console.log("========== LOAD DELIVERY ADDRESS ==========");
          console.log("Customer:", user.email);
          console.log("Customer ID:", user.customerId);
          console.log("Storage key:", storageKey);

          const raw = await AsyncStorage.getItem(storageKey);

          if (raw) {
            const saved = JSON.parse(raw);

            if (active) {
              setAddress(saved);
              setEditing(saved);
              setShowForm(false);
            }

            console.log("Saved delivery address loaded.");

            return;
          }

          console.log("No local delivery address found.");

          if (isSetup) {
            if (active) {
              setEditing({
                ...EMPTY_ADDRESS,
                fullName: user?.full_name || user?.name || "",
                email: user?.email || "",
                country: "Mauritius",
              });

              setShowForm(true);
            }

            return;
          }

          try {
            const account = await api.myAccount();

            const odooAddress: Address = {
              fullName:
                getValue(account?.name) || user?.full_name || user?.name || "",
              phone: getValue(account?.phone),
              email: getValue(account?.email) || user?.email || "",
              addressLine1: getValue(account?.street),
              addressLine2: getValue(account?.street2),
              city: getValue(account?.city),
              postalCode: getValue(account?.zip),
              country:
                getValue(account?.country_id) ||
                getValue(account?.country) ||
                "Mauritius",
            };

            const hasAddress =
              !!odooAddress.addressLine1 ||
              !!odooAddress.city ||
              !!odooAddress.postalCode;

            if (hasAddress && active) {
              setAddress(odooAddress);
              setEditing(odooAddress);
              setShowForm(false);

              await AsyncStorage.setItem(
                storageKey,
                JSON.stringify(odooAddress),
              );
            }
          } catch (error) {
            console.log("Could not load address from Odoo:", error);
          }
        } catch (error) {
          console.log("ADDRESS LOAD ERROR:", error);
        }
      }

      loadAddress();

      return () => {
        active = false;
      };
    }, [user?.customerId, user?.id, user?.email, isSetup]),
  );

  function openAdd() {
    setEditing({
      ...EMPTY_ADDRESS,
      fullName: user?.full_name || user?.name || "",
      email: user?.email || "",
      country: "Mauritius",
    });

    setShowForm(true);
  }

  function openEdit() {
    if (!address) {
      openAdd();
      return;
    }

    setEditing(address);
    setShowForm(true);
  }

  function updateField(key: keyof Address, value: string) {
    setEditing((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function saveAddress() {
    if (
      !editing.fullName.trim() ||
      !editing.phone.trim() ||
      !editing.email.trim() ||
      !editing.addressLine1.trim() ||
      !editing.city.trim() ||
      !editing.postalCode.trim()
    ) {
      Alert.alert(
        "Missing information",
        "Please complete your name, phone, email, address, city and postal code.",
      );

      return;
    }

    if (!user) {
      Alert.alert(
        "Sign in required",
        "Please sign in before saving your delivery address.",
      );

      return;
    }

    const storageKey = getAddressKey(user);

    if (!storageKey) {
      Alert.alert("Save error", "Could not identify the signed-in customer.");

      return;
    }

    setBusy(true);

    try {
      console.log("========== UPDATE ODOO DELIVERY ADDRESS ==========");

      const payload = {
        partner_name: editing.fullName.trim(),

        partner_phone: editing.phone.trim(),
        partner_email: editing.email.trim(),

        street1: editing.addressLine1.trim(),
        street2: editing.addressLine2.trim() || " ",

        city: editing.city.trim(),
        zip: editing.postalCode.trim(),

        /*
         * Temporary because the current Odoo endpoint
         * still requires proof fields.
         */
        address_proof: base64Encode("Mr India mobile address test"),
        address_proof_filename: "mobile_address_test.txt",
      };

      console.log("ODOO DELIVERY PAYLOAD:", JSON.stringify(payload, null, 2));

      const result = await api.updateAccount(payload);

      console.log(
        "ODOO DELIVERY UPDATE RESULT:",
        JSON.stringify(result, null, 2),
      );

      if (!result?.success) {
        throw new Error(
          result?.message ||
            "Mr India could not update your delivery information.",
        );
      }

      console.log("========== VERIFY ODOO DELIVERY ADDRESS ==========");

      const verify = await api.myAccount();

      console.log(
        "ODOO ACCOUNT AFTER UPDATE:",
        JSON.stringify(verify, null, 2),
      );

      const returnedPhone = normalizePhone(getValue(verify?.phone));

      const expectedPhone = normalizePhone(editing.phone);

      const returnedStreet = getValue(verify?.street);
      const returnedStreet2 = getValue(verify?.street2);
      const returnedCity = getValue(verify?.city);
      const returnedZip = getValue(verify?.zip);
      const returnedEmail = getValue(verify?.email);

      const expectedStreet = editing.addressLine1.trim();
      const expectedStreet2 = editing.addressLine2.trim();
      const expectedCity = editing.city.trim();
      const expectedZip = editing.postalCode.trim();
      const expectedEmail = editing.email.trim();

      const phoneSaved = returnedPhone === expectedPhone;

      const streetSaved = returnedStreet === expectedStreet;

      const street2Saved =
        expectedStreet2 === ""
          ? returnedStreet2 === "" || returnedStreet2 === " "
          : returnedStreet2 === expectedStreet2;

      const citySaved =
        returnedCity.toLowerCase() === expectedCity.toLowerCase();

      const zipSaved = returnedZip === expectedZip;

      const emailSaved =
        returnedEmail.toLowerCase() === expectedEmail.toLowerCase();

      console.log("DELIVERY ADDRESS VERIFICATION:", {
        phoneSaved,
        streetSaved,
        street2Saved,
        citySaved,
        zipSaved,
        emailSaved,
      });

      if (
        !phoneSaved ||
        !streetSaved ||
        !street2Saved ||
        !citySaved ||
        !zipSaved ||
        !emailSaved
      ) {
        throw new Error(
          "Mr India received the address, but the saved values could not be confirmed.",
        );
      }

      const savedAddress: Address = {
        fullName: editing.fullName.trim(),
        phone: editing.phone.trim(),
        email: editing.email.trim(),

        addressLine1: editing.addressLine1.trim(),

        addressLine2: editing.addressLine2.trim(),

        city: editing.city.trim(),
        postalCode: editing.postalCode.trim(),

        country: editing.country.trim() || "Mauritius",
      };

      await AsyncStorage.setItem(storageKey, JSON.stringify(savedAddress));

      setAddress(savedAddress);
      setEditing(savedAddress);
      setShowForm(false);

      console.log("DELIVERY ADDRESS SAVED SUCCESSFULLY");

      if (isSetup) {
        Alert.alert(
          "Profile complete",
          "Your contact and delivery information has been saved successfully.",
          [
            {
              text: "Continue shopping",
              onPress: () => router.replace("/"),
            },
          ],
        );

        return;
      }

      Alert.alert(
        "Address updated",
        "Your delivery address has been updated successfully.",
      );
    } catch (error: any) {
      console.log("========== DELIVERY ADDRESS ERROR ==========");

      console.log(error);

      Alert.alert(
        "Could not save address",
        error?.message || "Your delivery information could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={s.wrap}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          {!isSetup && (
            <TouchableOpacity
              onPress={() => router.replace("/account")}
              style={s.backBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-back" size={25} color={COLORS.t1} />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }}>
            <Text style={s.title}>
              {isSetup ? "Complete your profile" : "Delivery Address"}
            </Text>

            <Text style={s.sub}>
              {isSetup
                ? "Add your contact and delivery information to finish setting up your account."
                : "View or update the address used for your Mr India deliveries."}
            </Text>
          </View>
        </View>

        {!showForm && !address && (
          <>
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}>
                <Ionicons
                  name="location-outline"
                  size={34}
                  color={COLORS.amber}
                />
              </View>

              <Text style={s.emptyTitle}>No delivery address yet</Text>

              <Text style={s.emptyText}>
                Add your delivery information so checkout can be completed
                faster.
              </Text>
            </View>

            <TouchableOpacity
              onPress={openAdd}
              activeOpacity={0.9}
              style={{ marginTop: 16 }}
            >
              <LinearGradient
                colors={GRAD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtn}
              >
                <Ionicons name="location-outline" size={20} color="#FFFFFF" />

                <Text style={s.primaryBtnTxt}>Add delivery address</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {!showForm && address && (
          <>
            <View style={s.addressCard}>
              <View style={s.addressTop}>
                <View style={s.iconBox}>
                  <Ionicons
                    name="location-outline"
                    size={21}
                    color={COLORS.amber}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Delivery Address</Text>

                  <Text style={s.cardName}>{address.fullName}</Text>
                </View>
              </View>

              <Text style={s.addressText}>
                {address.addressLine1}
                {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                {"\n"}
                {address.city} {address.postalCode}
                {"\n"}
                {address.country}
                {"\n"}
                {address.phone}
                {"\n"}
                {address.email}
              </Text>
            </View>

            <TouchableOpacity onPress={openEdit} activeOpacity={0.9}>
              <LinearGradient
                colors={GRAD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtn}
              >
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />

                <Text style={s.primaryBtnTxt}>Edit delivery address</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {showForm && (
          <View style={s.formWrap}>
            <View style={s.formHeading}>
              <View style={{ flex: 1 }}>
                <Text style={s.formTitle}>
                  {isSetup
                    ? "Your information"
                    : address
                      ? "Edit delivery address"
                      : "Add delivery address"}
                </Text>

                <Text style={s.formSub}>
                  {isSetup
                    ? "Complete the details below to finish creating your Mr India account."
                    : "These details will be used for delivery and checkout."}
                </Text>
              </View>

              {!isSetup && (
                <TouchableOpacity
                  onPress={() => {
                    if (address) {
                      setEditing(address);
                    }

                    setShowForm(false);
                  }}
                  style={s.closeBtn}
                >
                  <Ionicons name="close" size={22} color={COLORS.t1} />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.formCard}>
              <Field
                s={s}
                COLORS={COLORS}
                label="Full name"
                required
                value={editing.fullName}
                onChangeText={(value: string) => updateField("fullName", value)}
                placeholder="Full name"
                autoCapitalize="words"
              />

              <Field
                s={s}
                COLORS={COLORS}
                label="Email"
                required
                value={editing.email}
                onChangeText={(value: string) => updateField("email", value)}
                placeholder="Email address"
                keyboardType="email-address"
              />

              <Field
                s={s}
                COLORS={COLORS}
                label="Phone number"
                required
                value={editing.phone}
                onChangeText={(value: string) => updateField("phone", value)}
                placeholder="5XXXXXXX"
                keyboardType="phone-pad"
              />

              <Field
                s={s}
                COLORS={COLORS}
                label="Address line 1"
                required
                value={editing.addressLine1}
                onChangeText={(value: string) =>
                  updateField("addressLine1", value)
                }
                placeholder="Street and house number"
                autoCapitalize="words"
              />

              <Field
                s={s}
                COLORS={COLORS}
                label="Address line 2"
                value={editing.addressLine2}
                onChangeText={(value: string) =>
                  updateField("addressLine2", value)
                }
                placeholder="Apartment, building or landmark"
                autoCapitalize="words"
              />

              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Field
                    s={s}
                    COLORS={COLORS}
                    label="City"
                    required
                    value={editing.city}
                    onChangeText={(value: string) => updateField("city", value)}
                    placeholder="City"
                    autoCapitalize="words"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Field
                    s={s}
                    COLORS={COLORS}
                    label="Postal code"
                    required
                    value={editing.postalCode}
                    onChangeText={(value: string) =>
                      updateField("postalCode", value)
                    }
                    placeholder="Postal code"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Field
                s={s}
                COLORS={COLORS}
                label="Country"
                required
                value={editing.country}
                onChangeText={(value: string) => updateField("country", value)}
                placeholder="Mauritius"
                autoCapitalize="words"
              />
            </View>

            <TouchableOpacity
              onPress={saveAddress}
              activeOpacity={0.9}
              disabled={busy}
            >
              <LinearGradient
                colors={GRAD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  s.primaryBtn,
                  busy && {
                    opacity: 0.7,
                  },
                ]}
              >
                {busy ? (
                  <Text style={s.primaryBtnTxt}>Saving...</Text>
                ) : (
                  <>
                    <Text style={s.primaryBtnTxt}>
                      {isSetup ? "Complete profile" : "Save changes"}
                    </Text>

                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {!showForm && (
          <Text style={s.infoText}>
            This is the delivery address used by Mr India for your account and
            checkout.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Field = ({ s, COLORS, label, required, ...props }: any) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>
      {label}
      {required ? " *" : ""}
    </Text>

    <TextInput style={s.input} placeholderTextColor={COLORS.t3} {...props} />
  </View>
);

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
      paddingBottom: 100,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 24,
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

    title: {
      color: COLORS.t1,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -0.8,
    },

    sub: {
      color: COLORS.t3,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },

    emptyCard: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 24,
      alignItems: "center",
    },

    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 19,
      backgroundColor: COLORS.bg2,
      alignItems: "center",
      justifyContent: "center",
    },

    emptyTitle: {
      color: COLORS.t1,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 14,
    },

    emptyText: {
      color: COLORS.t3,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      marginTop: 6,
      maxWidth: 280,
    },

    addressCard: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 22,
      padding: 17,
      marginBottom: 16,
    },

    addressTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: COLORS.bg2,
      alignItems: "center",
      justifyContent: "center",
    },

    cardTitle: {
      color: COLORS.t1,
      fontSize: 16,
      fontWeight: "900",
    },

    cardName: {
      color: COLORS.t3,
      fontSize: 13,
      marginTop: 2,
    },

    addressText: {
      color: COLORS.t2,
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: 14,
    },

    formWrap: {
      marginBottom: 20,
    },

    formHeading: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 14,
      paddingHorizontal: 3,
    },

    formTitle: {
      color: COLORS.t1,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.5,
    },

    formSub: {
      color: COLORS.t3,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
      maxWidth: 290,
    },

    closeBtn: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: COLORS.bg2,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },

    formCard: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 24,
      padding: 16,
      marginBottom: 16,
    },

    fieldWrap: {
      marginBottom: 14,
    },

    fieldLabel: {
      color: COLORS.amber,
      fontSize: 11.5,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.35,
      marginBottom: 7,
      marginLeft: 2,
    },

    input: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: COLORS.t1,
      fontSize: 15,
    },

    twoCol: {
      flexDirection: "row",
      gap: 12,
    },

    primaryBtn: {
      borderRadius: 18,
      paddingVertical: 17,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 9,
      shadowColor: COLORS.amber,
      shadowOpacity: 0.22,
      shadowRadius: 14,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation: 7,
    },

    primaryBtnTxt: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "900",
    },

    infoText: {
      color: COLORS.t3,
      fontSize: 12.5,
      lineHeight: 19,
      textAlign: "center",
      marginTop: 18,
      paddingHorizontal: 16,
    },
  });
