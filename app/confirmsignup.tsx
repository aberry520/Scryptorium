import { supabase } from "@/lib/supabase";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const COLORS = {
  tan: "#C49A7A",
  cream: "#FAF5EE",
  ink: "#2C1F14",
  inkFaint: "#6B5040",
  inkMuted: "#A08878",
};

const serif = Platform.OS === "ios" ? "Georgia" : "serif";

export default function ConfirmSignUp() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your account…");

  useEffect(() => {
    const confirm = async () => {
      try {
        let token: string | undefined;
        let tokenHash: string | undefined;
        let email: string | undefined;
        let type: string = "signup";

        if (Platform.OS === "web") {
          // Supabase sends token_hash + type as query params on web
          const params = new URLSearchParams(window.location.search);
          tokenHash = params.get("token_hash") ?? undefined;
          type = params.get("type") ?? "signup";
        } else {
          // Native: token + email come via deep link
          const url = await Linking.getInitialURL();
          if (!url) {
            setStatus("error");
            setMessage("No confirmation URL found.");
            return;
          }
          const { queryParams } = Linking.parse(url);
          token = queryParams?.token as string | undefined;
          email = queryParams?.email as string | undefined;
          type = (queryParams?.type as string | undefined) ?? "signup";
        }

        if (Platform.OS === "web" && !tokenHash) {
          setStatus("error");
          setMessage("No confirmation token found in URL.");
          return;
        }
        if (Platform.OS !== "web" && (!token || !email)) {
          setStatus("error");
          setMessage("Missing token or email in confirmation URL.");
          return;
        }

        const { error } = await supabase.auth.verifyOtp(
          Platform.OS === "web"
            ? { token_hash: tokenHash!, type: type as any }
            : { token: token!, type: type as any, email: email! }
        );
        await supabase.auth.signOut();

        if (error) {
          setTimeout(() => {
            setStatus("error");
            setMessage(error.message);
          }, 3000);
        } else {
          setTimeout(() => {
            setStatus("success");
            setMessage("Your email has been verified and your account is ready.");
          }, 3000);
        }

      } catch {
        setStatus("error");
        setMessage("An unexpected error occurred.");
      }
    };

    confirm();
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color={COLORS.tan} style={styles.spinner} />
            <Text style={styles.heading}>Confirming…</Text>
            <Text style={styles.body}>{message}</Text>
          </>
        )}
        {status === "success" && (
          <>
            <Text style={styles.emoji}>✅</Text>
            <Text style={styles.heading}>Email verified!</Text>
            <Text style={styles.body}>{message}</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace("/(auth)/login")}
              activeOpacity={0.82}
            >
              <Text style={styles.btnText}>Continue to Login</Text>
            </TouchableOpacity>
          </>
        )}
        {status === "error" && (
          <>
            <Text style={styles.emoji}>❌</Text>
            <Text style={[styles.heading, styles.headingError]}>Something went wrong</Text>
            <Text style={styles.body}>{message}</Text>
            <Text style={styles.hint}>The link may have expired. Try signing up again.</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace("/(auth)/login")}
              activeOpacity={0.82}
            >
              <Text style={styles.btnText}>Back to Login</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <Text style={styles.ornament}>✦</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 36,
    alignItems: "center",
    width: "100%",
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
    borderTopWidth: 5,
    borderTopColor: COLORS.tan,
  },
  spinner: {
    marginBottom: 20,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  heading: {
    fontFamily: serif,
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.ink,
    marginBottom: 10,
  },
  headingError: {
    color: "#B03A2A",
  },
  body: {
    fontFamily: serif,
    fontSize: 14,
    color: COLORS.inkFaint,
    textAlign: "center",
    lineHeight: 22,
  },
  hint: {
    fontFamily: serif,
    fontSize: 13,
    color: COLORS.inkMuted,
    textAlign: "center",
    marginTop: 10,
    fontStyle: "italic",
  },
  ornament: {
    color: "#D4B69A",
    fontSize: 16,
    marginTop: 28,
  },
  btn: {
    backgroundColor: COLORS.tan,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 40,
    alignItems: "center",
    marginTop: 20,
  },
  btnText: {
    fontFamily: serif,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});