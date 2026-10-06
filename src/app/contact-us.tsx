import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { getColors } from "../lib/mrindia";

const CONTACT_URL = "https://www.mrindia.mu/mi/contact_us";

export default function ContactUsScreen() {
  const router = useRouter();

  const scheme = useColorScheme();
  const COLORS = getColors(scheme === "dark");

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: COLORS.bg }]}
      edges={["top", "left", "right"]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: COLORS.bg,
            borderBottomColor: COLORS.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.replace("/account")}
          style={[
            styles.backButton,
            {
              backgroundColor: COLORS.bg2,
              borderColor: COLORS.border,
            },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={25} color={COLORS.t1} />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={[styles.title, { color: COLORS.t1 }]}>Contact Us</Text>

          <Text style={[styles.subtitle, { color: COLORS.t3 }]}>
            Get assistance with your order
          </Text>
        </View>
      </View>

      <View style={styles.webContainer}>
        {loading && !failed && (
          <View style={[styles.loadingOverlay, { backgroundColor: COLORS.bg }]}>
            <ActivityIndicator size="large" color={COLORS.amber} />

            <Text style={[styles.loadingText, { color: COLORS.t2 }]}>
              Loading support page...
            </Text>
          </View>
        )}

        {failed ? (
          <View style={styles.errorContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={52}
              color={COLORS.rose}
            />

            <Text style={[styles.errorTitle, { color: COLORS.t1 }]}>
              Unable to load Contact Us
            </Text>

            <Text style={[styles.errorText, { color: COLORS.t2 }]}>
              Please check your internet connection and try again.
            </Text>

            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: COLORS.amber }]}
              onPress={() => {
                setFailed(false);
                setLoading(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ uri: CONTACT_URL }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            startInLoadingState={false}
            injectedJavaScript={`
              (function () {
                try {
                  const forms = Array.from(document.querySelectorAll("form"));

                  const contactForm = forms.find((form) => {
                    const txt = (form.innerText || "").toLowerCase();

                    return (
                      txt.includes("first name") &&
                      txt.includes("last name") &&
                      txt.includes("how can we help")
                    );
                  });

                  if (!contactForm) {
                    console.log("MR INDIA CONTACT FORM NOT FOUND");
                    true;
                    return;
                  }

                  // Hide everything except the contact form and its ancestor chain.
                  let node = contactForm;

                  while (node && node !== document.body) {
                    const parent = node.parentElement;

                    if (!parent) break;

                    Array.from(parent.children).forEach((child) => {
                      if (child !== node) {
                        child.style.setProperty(
                          "display",
                          "none",
                          "important"
                        );
                      }
                    });

                    node = parent;
                  }

                  document.documentElement.style.setProperty(
                    "background",
                    "#ffffff",
                    "important"
                  );

                  document.body.style.setProperty(
                    "background",
                    "#ffffff",
                    "important"
                  );

                  document.body.style.setProperty(
                    "margin",
                    "0",
                    "important"
                  );

                  document.body.style.setProperty(
                    "padding",
                    "0",
                    "important"
                  );

                  document.body.style.setProperty(
                    "overflow-x",
                    "hidden",
                    "important"
                  );

                  contactForm.style.setProperty(
                    "display",
                    "block",
                    "important"
                  );

                  contactForm.style.setProperty(
                    "width",
                    "100%",
                    "important"
                  );

                  contactForm.style.setProperty(
                    "max-width",
                    "100%",
                    "important"
                  );

                  contactForm.style.setProperty(
                    "margin",
                    "0",
                    "important"
                  );

                  contactForm.style.setProperty(
                    "padding",
                    "16px",
                    "important"
                  );

                  contactForm.style.setProperty(
                    "box-sizing",
                    "border-box",
                    "important"
                  );

                  // Remove common website-only elements if they survived.
                  [
                    "header",
                    "footer",
                    "nav",
                    ".navbar",
                    ".o_header_standard",
                    ".o_footer",
                    ".o_livechat_button",
                    ".o_livechat_chatbot",
                    ".o_livechat_channel",
                    "#wrapwrap > header",
                    "#wrapwrap > footer"
                  ].forEach((selector) => {
                    document.querySelectorAll(selector).forEach((el) => {
                      el.style.setProperty(
                        "display",
                        "none",
                        "important"
                      );
                    });
                  });

                  window.scrollTo(0, 0);
                } catch (error) {
                  console.log(
                    "MR INDIA CONTACT FORM FILTER ERROR",
                    String(error)
                  );
                }

                true;
              })();
            `}
            onLoadStart={() => {
              setFailed(false);
              setLoading(true);
            }}
            onLoadEnd={() => {
              setLoading(false);
            }}
            onError={(event) => {
              console.log("CONTACT US WEBVIEW ERROR:", event.nativeEvent);

              setLoading(false);
              setFailed(true);
            }}
            onHttpError={(event) => {
              console.log("CONTACT US HTTP ERROR:", event.nativeEvent);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    marginLeft: 14,
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
  },

  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  webContainer: {
    flex: 1,
  },

  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "700",
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  errorTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  errorText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  retryButton: {
    marginTop: 22,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },

  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
