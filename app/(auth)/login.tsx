import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { supabase } from "../../lib/supabase";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const COLORS = {
  tan: "#C49A7A",
  tanLight: "#D4B69A",
  tanDark: "#A07850",
  cream: "#FAF5EE",
  cardBg: "#FFFFFF",
  ink: "#2C1F14",
  inkFaint: "#6B5040",
  inkMuted: "#A08878",
  white: "#FFFFFF",
  inputBorder: "#DDD0C0",
  inputBg: "#FBF8F3",
  errorRed: "#B03A2A",
};

const serif = Platform.OS === "ios" ? "Georgia" : "serif";

// ─── Styled Input ─────────────────────────────────────────────────────────────
function StyledInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[inputStyles.wrapper, focused && inputStyles.focused]}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput
        style={inputStyles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? "sentences"}
        keyboardType={keyboardType ?? "default"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSignUp = async () => {
    setError("");
    setLoading(true);
    try {
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: "https://scryptorium.vercel.app/confirmsignup",
  },
});
      if (authError) { setError(authError.message); return; }
      const userId = authData.user?.id;
      if (!userId) { setError("Unable to get user ID from signup."); return; }
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([{ id: userId, name: "" }]);
      if (profileError) { setError(profileError.message); return; }
      // ✅ Success — show verify modal and switch to login
      setShowVerifyModal(true);
      setMode("login");
    } catch {
      setError("An unexpected error occurred during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <View style={styles.root}>
      {/* Soft tan wash behind the logo area */}
      <View style={styles.bgBloom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <Image source={require("../../assets/images/book.jpg")} style={{ width: 80, height: 80, borderRadius: 20 }} />
          <Text style={styles.appName}>Scryptorium</Text>
          <Text style={styles.tagline}>your reading life, beautifully kept</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardAccentBar} />
          <Text style={styles.cardTitle}>{isLogin ? "Welcome back" : "Create account"}</Text>
          <Text style={styles.cardSub}>
            {isLogin ? "Sign in to continue reading" : "Begin your reading journey"}
          </Text>

          <View style={styles.form}>
            <StyledInput
              label="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <StyledInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.55 }]}
              onPress={isLogin ? handleLogin : handleSignUp}
              disabled={loading}
              activeOpacity={0.82}
            >
              <Text style={styles.btnText}>
                {loading ? "Please wait…" : isLogin ? "Log In" : "Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggle}>
            <Text style={styles.toggleLabel}>
              {isLogin ? "New to Scryptorium?" : "Already a member?"}
            </Text>
            <Pressable onPress={() => { setError(""); setMode(isLogin ? "signup" : "login"); }}>
              <Text style={styles.toggleLink}>{isLogin ? "Sign up" : "Log in"}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.ornament}>✦</Text>
      </KeyboardAvoidingView>

      {/* ─── Verify Email Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showVerifyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVerifyModal(false)}
      >
        <Pressable style={modalStyles.backdrop} onPress={() => setShowVerifyModal(false)}>
          <Pressable style={modalStyles.card} onPress={(e) => e.stopPropagation()}>
            <View style={modalStyles.iconWrap}>
              <Text style={modalStyles.iconText}>✉️</Text>
            </View>
            <Text style={modalStyles.title}>Check your email</Text>
            <Text style={modalStyles.body}>
              We sent a verification link to{"\n"}
              <Text style={modalStyles.emailText}>{email}</Text>
              {"\n\n"}
              Click the link to verify your account, then come back and log in.
            </Text>
            <TouchableOpacity
              style={modalStyles.btn}
              onPress={() => setShowVerifyModal(false)}
              activeOpacity={0.82}
            >
              <Text style={modalStyles.btnText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  bgBloom: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: COLORS.tan,
    opacity: 0.18,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  brand: {
    alignItems: "center",
    marginBottom: 30,
  },
  appName: {
    fontFamily: serif,
    fontSize: 29,
    fontWeight: "700",
    color: COLORS.ink,
    letterSpacing: 1.5,
    marginTop: 14,
  },
  tagline: {
    fontFamily: serif,
    fontSize: 12,
    fontStyle: "italic",
    color: COLORS.inkFaint,
    marginTop: 5,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
    overflow: "hidden",
  },
  cardAccentBar: {
    height: 5,
    backgroundColor: COLORS.tan,
    marginBottom: 24,
    marginHorizontal: -24,
  },
  cardTitle: {
    fontFamily: serif,
    fontSize: 21,
    fontWeight: "700",
    color: COLORS.ink,
    marginBottom: 4,
  },
  cardSub: {
    fontFamily: serif,
    fontSize: 13,
    fontStyle: "italic",
    color: COLORS.inkMuted,
    marginBottom: 22,
  },
  form: {
    gap: 14,
    marginBottom: 18,
  },
  btn: {
    backgroundColor: COLORS.tan,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: {
    fontFamily: serif,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  errorBox: {
    backgroundColor: "#FDF0EE",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.errorRed,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: COLORS.errorRed,
    fontSize: 13,
    fontFamily: serif,
  },
  toggle: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    alignItems: "center",
  },
  toggleLabel: {
    fontFamily: serif,
    color: COLORS.inkMuted,
    fontSize: 13,
  },
  toggleLink: {
    fontFamily: serif,
    color: COLORS.tanDark,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  ornament: {
    textAlign: "center",
    color: COLORS.tanLight,
    fontSize: 16,
    marginTop: 22,
  },
});

const inputStyles = StyleSheet.create({
  wrapper: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: 10,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 8,
  },
  focused: {
    borderColor: COLORS.tan,
    backgroundColor: COLORS.white,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: COLORS.inkMuted,
    fontFamily: serif,
    marginBottom: 2,
  },
  input: {
    fontSize: 16,
    color: COLORS.ink,
    fontFamily: serif,
    paddingVertical: 2,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(44, 31, 20, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: "center",
    width: "100%",
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderTopWidth: 5,
    borderTopColor: COLORS.tan,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.inputBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconText: {
    fontSize: 30,
  },
  title: {
    fontFamily: serif,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.ink,
    marginBottom: 12,
  },
  body: {
    fontFamily: serif,
    fontSize: 14,
    color: COLORS.inkFaint,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emailText: {
    fontWeight: "700",
    color: COLORS.ink,
  },
  btn: {
    backgroundColor: COLORS.tan,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  btnText: {
    fontFamily: serif,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});