import { useState } from "react";
import {
  View,
  Button,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { ThemedView } from "@/components/themed-view";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedText } from "@/components/themed-text";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
  };

  const handleSignUp = async () => {
    setError(""); // clear previous error

    try {
      // 1️⃣ Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setError("Unable to get user ID from signup.");
        return;
      }

      // 2️⃣ Create the profile row
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .insert([{ id: userId, name: "" }]); // you could prompt for name later

      if (profileError) {
        setError(profileError.message);
        return;
      }

      console.log("Profile created successfully!", profileData);
    } catch (err) {
      console.error("Sign up error:", err);
      setError("An unexpected error occurred during sign up.");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <ThemedText type="title" style={styles.title}>
          Welcome Back
        </ThemedText>
        <ThemedText type="default" style={styles.subtitle}>
          Log in to your account
        </ThemedText>

        <View style={styles.form}>
          <ThemedTextInput
            type="outlined"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <ThemedTextInput
            type="outlined"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          <Button title="Log In" onPress={handleLogin} />
          <Button title="Sign Up" onPress={handleSignUp} />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 32,
    opacity: 0.6,
  },
  form: {
    gap: 12,
  },
  error: {
    color: "red",
    fontSize: 14,
  },
});
