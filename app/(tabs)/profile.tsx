import { View, StyleSheet } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { LogoutButton } from "@/components/logout-button";
import { useAuth } from "@/context/AuthContext";

export default function ProfileScreen() {
  const { session } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
        <ThemedText type="default" style={styles.email}>
          {session?.user.email}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <LogoutButton />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    flex: 1,
    paddingTop: 60,
  },
  email: {
    marginTop: 8,
    opacity: 0.6,
  },
  footer: {
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "gray",
    paddingTop: 16,
  },
});
