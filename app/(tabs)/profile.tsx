import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { LogoutButton } from "@/components/logout-button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch existing profile name on mount
  useEffect(() => {
    if (!session?.user.id) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setName(data.name);
      });
  }, [session?.user.id]);

  const startEditing = () => {
    setEditingName(name);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingName("");
  };

  const saveName = async () => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      Alert.alert("Error", "Name can't be empty.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: session!.user.id, name: trimmed });
      if (error) throw error;
      setName(trimmed);
      setIsEditing(false);
    } catch (e: any) {
      Alert.alert("Error saving name", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>

        {/* Name row */}
        <View style={styles.nameRow}>
          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.nameInput}
                value={editingName}
                onChangeText={setEditingName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveName}
                placeholder="Your name"
                placeholderTextColor="rgba(128,128,128,0.5)"
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={saveName}
                  disabled={loading}
                  style={[styles.actionBtn, styles.saveBtn]}
                >
                  <ThemedText style={styles.saveBtnText}>
                    {loading ? "Saving…" : "Save"}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={cancelEditing}
                  style={styles.actionBtn}
                >
                  <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={startEditing} style={styles.nameDisplay}>
              <ThemedText type="defaultSemiBold" style={styles.nameText}>
                {name || "Add your name"}
              </ThemedText>
              <ThemedText style={styles.editHint}>✎ edit</ThemedText>
            </TouchableOpacity>
          )}
        </View>

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
  nameRow: {
    marginTop: 20,
    marginBottom: 4,
  },
  nameDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nameText: {
    fontSize: 20,
  },
  editHint: {
    fontSize: 12,
    opacity: 0.4,
  },
  editRow: {
    gap: 10,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: "600",
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(128,128,128,0.4)",
    paddingVertical: 4,
    color: "inherit",
  },
  editActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveBtn: {
    backgroundColor: "rgba(128,128,128,0.15)",
  },
  saveBtnText: {
    fontWeight: "600",
  },
  cancelBtnText: {
    opacity: 0.5,
  },
  email: {
    marginTop: 4,
    opacity: 0.4,
    fontSize: 13,
  },
  footer: {
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "gray",
    paddingTop: 16,
  },
});
