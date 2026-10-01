// src/app/_layout.tsx â€” root layout: cart/auth provider + premium bottom tabs.
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StatusBar, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "../lib/mrindia";

// Renders the application's tab navigator using data from the shared store.
function TabsInner() {
  // Retrieve the current cart quantity for the cart tab badge.
  const { cartCount } = useStore();
  const router = useRouter();

  useEffect(() => {
    router.replace("/splash");
  }, []);
  // Get safe-area spacing for devices with a home indicator or screen notch.
  const insets = useSafeAreaInsets();
  // Create a reusable tab icon renderer for each route.
  const icon =
    (name: any) =>
    ({ color, size }: any) => (
      <Ionicons name={name} size={size ?? 22} color={color} />
    );

  // Detect the device color scheme and determine the active theme.
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  // Define light and dark colors used by the status bar and tab navigator.
  const theme = {
    bg: isDark ? "#070A12" : "#F3EEE6",
    tab: isDark ? "#0C1322" : "#FFF9F0",
    border: isDark ? "#1E2A3D" : "#E6D8C8",
    active: "#FF9500",
    inactive: isDark ? "#8792A2" : "#7C8798",
  };

  return (
    <>
      {/* Match the system status bar to the active application theme. */}
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
        translucent={false}
      />
      {/* Configure the application's bottom-tab navigator. */}
      <Tabs
        initialRouteName="splash"
        screenOptions={{
          // Individual screens do not use the default navigation header.
          headerShown: false,
          // Style the bottom bar and include the device's safe-area spacing.
          tabBarStyle: {
            backgroundColor: theme.tab,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            height: 64 + insets.bottom,
            paddingTop: 7,
            paddingBottom: Math.max(insets.bottom, 8),

            elevation: 10,
            shadowColor: "#000",
            shadowOpacity: isDark ? 0.25 : 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 },
          },
          // Style the item-count badge displayed on the cart tab.
          tabBarBadgeStyle: {
            backgroundColor: "#FF2D3D",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: "900",
            borderWidth: 1,
            borderColor: theme.tab,
          },

          tabBarItemStyle: {
            backgroundColor: "transparent",
          },

          tabBarActiveBackgroundColor: "transparent",
          tabBarInactiveBackgroundColor: "transparent",
          // Set the active and inactive icon and label colors.
          tabBarActiveTintColor: theme.active,
          tabBarInactiveTintColor: theme.inactive,

          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "700",
          },

          tabBarIconStyle: {
            marginTop: 2,
          },
          // Use a custom button to prevent unwanted backgrounds and ripple colors.
          tabBarButton: (props: any) => {
            const { ref: _ref, style, ...rest } = props;

            return (
              <Pressable
                {...rest}
                android_ripple={{
                  color: "transparent",
                  borderless: false,
                }}
                style={[
                  style,
                  {
                    backgroundColor: "transparent",
                    opacity: 1,
                  },
                ]}
              />
            );
          },
        }}
      >
        {/* Main shopping tab. */}
        <Tabs.Screen
          name="index"
          options={{
            headerShown: false,
            title: "Shop",
            tabBarIcon: icon("home"),
          }}
        />
        {/* Initial splash screen, hidden from the bottom tab bar. */}
        <Tabs.Screen
          name="splash"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Cart tab with a badge showing the current number of items. */}
        <Tabs.Screen
          name="cart"
          options={{
            title: "Your Cart",
            tabBarIcon: icon("bag-handle"),
            tabBarBadge: cartCount || undefined,
          }}
        />
        {/* Order history and tracking tab. */}
        <Tabs.Screen
          name="orders"
          options={{ title: "Orders", tabBarIcon: icon("cube") }}
        />
        {/* User profile and account tab. */}
        <Tabs.Screen
          name="account"
          options={{ title: "Account", tabBarIcon: icon("person") }}
        />
        {/* Internal browser screen, accessible through navigation only. */}
        <Tabs.Screen
          name="browser"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Checkout screen, hidden from the bottom tab bar. */}
        <Tabs.Screen
          name="checkout"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />

        <Tabs.Screen
          name="order-details"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Wallet screen, accessible from Account only. */}
      <Tabs.Screen
        name="wallet"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
      {/* Onboarding guide, hidden from the bottom tab bar. */}
        <Tabs.Screen
          name="onboarding"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Authentication screen, hidden from the bottom tab bar. */}
        <Tabs.Screen
          name="signin"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Address-management screen, hidden from the bottom tab bar. */}
        <Tabs.Screen
          name="addresses"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Shipping and service-fee information screen. */}
        <Tabs.Screen
          name="fees"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Shipping eligibility and restriction information screen. */}
        <Tabs.Screen
          name="shipping-rules"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
        {/* Terms and conditions screen, hidden from the bottom tab bar. */}
        <Tabs.Screen
          name="terms"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        />
      </Tabs>
    </>
  );
}

// Wrap the navigator with the global cart and authentication state provider.
export default function RootLayout() {
  return (
    <StoreProvider>
      <TabsInner />
    </StoreProvider>
  );
}




