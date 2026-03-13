import { supabase } from "@/lib/supabase"; // adjust your import path
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function ConfirmSignUp({ navigation }: any) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState<string>("Confirming your account...");

  useEffect(() => {
    const getInitialURL = async () => {
      // Get the URL that opened the app
      const url = await Linking.getInitialURL();
      if (!url) {
        setStatus("error");
        setMessage("No confirmation URL found.");
        return;
      }

      // Parse the token and email from the URL query params
      const { queryParams } = Linking.parse(url);
      const token = queryParams?.token as string;
      const email = queryParams?.email as string;
      if (!token) {
        setStatus("error");
        setMessage("No confirmation token in URL.");
        return;
      }
      if (!email) {
        setStatus("error");
        setMessage("No email found in confirmation URL.");
        return;
      }

      // Confirm sign-up with Supabase
      const { error } = await supabase.auth.verifyOtp({
        token: token,
        type: "signup",
        email: email,
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("success");
        setMessage("Your account has been confirmed! Redirecting...");
        setTimeout(() => {
          navigation.replace("Dashboard"); // change to your screen name
        }, 2000);
      }
    };

    getInitialURL();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {status === "loading"
          ? "Confirming..."
          : status === "success"
            ? "Success!"
            : "Error"}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {status === "loading" && <ActivityIndicator size="large" color="#555" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
  },
});
