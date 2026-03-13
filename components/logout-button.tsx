import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/supabase";
import { Alert, Platform, StyleSheet, TouchableOpacity } from "react-native";

export function LogoutButton() {
  const color = useThemeColor({}, "tint");

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (confirmed) {
        await supabase.auth.signOut();
      }
      return;
    }

    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => await supabase.auth.signOut(),
      },
    ]);
  };

  return (
    <TouchableOpacity onPress={handleLogout} style={styles.button}>
      <ThemedText style={[styles.text, { color }]}>Log Out</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
