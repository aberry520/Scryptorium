import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { LogoutButton } from "@/components/logout-button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { QRPayload } from "@/types";

export default function ProfileScreen() {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

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

  const qrValue: string = JSON.stringify({
    type: "bookshelf_user",
    userId: session?.user.id ?? "",
    name: (name || session?.user.email) ?? "",
  } satisfies QRPayload);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
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
              <TouchableOpacity
                onPress={startEditing}
                style={styles.nameDisplay}
              >
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

        {/* ── QR card ── */}
        <View style={styles.qrCard}>
          <ThemedText style={styles.qrLabel}>MY LIBRARY CODE</ThemedText>
          <ThemedText style={styles.qrSublabel}>
            Let someone scan this to lend a book directly to your library
          </ThemedText>

          {/* Inline preview (small) */}
          <TouchableOpacity
            style={styles.qrPreviewWrapper}
            onPress={() => setShowQR(true)}
            activeOpacity={0.8}
          >
            <View style={styles.qrPreview}>
              <QRCode
                value={qrValue}
                size={120}
                color="#1A1210"
                backgroundColor="#F5ECD7"
              />
            </View>
            <ThemedText style={styles.qrTapHint}>Tap to enlarge</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <LogoutButton />
      </View>

      {/* ── Full-screen QR modal ── */}
      <Modal
        visible={showQR}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQR(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.qrModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowQR(false)}
        >
          <View style={styles.qrModalCard}>
            {/* Decorative corner marks */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            <ThemedText style={styles.qrModalName}>
              {name || session?.user.email}
            </ThemedText>
            <ThemedText style={styles.qrModalSub}>LIBRARY CODE</ThemedText>

            <View style={styles.qrModalCode}>
              <QRCode
                value={qrValue}
                size={220}
                color="#1A1210"
                backgroundColor="#F5ECD7"
              />
            </View>

            <ThemedText style={styles.qrModalDismiss}>
              Tap anywhere to close
            </ThemedText>
          </View>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

const CORNER_SIZE = 18;
const CORNER_THICKNESS = 2.5;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  scroll: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: 16,
  },

  // ── Profile ──
  header: {
    marginBottom: 32,
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
    color: "rgba(141, 141, 141, 0.9)",
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

  // ── QR card ──
  qrCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.2)",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  qrLabel: {
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: "700",
    opacity: 0.5,
  },
  qrSublabel: {
    fontSize: 12,
    opacity: 0.45,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 8,
  },
  qrPreviewWrapper: {
    alignItems: "center",
    gap: 8,
  },
  qrPreview: {
    padding: 12,
    backgroundColor: "#F5ECD7",
    borderRadius: 10,
  },
  qrTapHint: {
    fontSize: 11,
    opacity: 0.35,
    letterSpacing: 0.5,
  },

  // ── Footer ──
  footer: {
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "gray",
    paddingTop: 16,
  },

  // ── QR modal ──
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
  },
  qrModalCard: {
    backgroundColor: "#F5ECD7",
    borderRadius: 16,
    padding: 36,
    alignItems: "center",
    gap: 6,
    marginHorizontal: 32,
    position: "relative",
  },
  qrModalName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1210",
    fontFamily: "Georgia",
    textAlign: "center",
  },
  qrModalSub: {
    fontSize: 9,
    letterSpacing: 3,
    color: "#8B6340",
    fontWeight: "700",
    marginBottom: 16,
  },
  qrModalCode: {
    padding: 4,
  },
  qrModalDismiss: {
    fontSize: 11,
    color: "#8B6340",
    opacity: 0.5,
    marginTop: 16,
    letterSpacing: 0.3,
  },

  // Corner decoration marks
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "#8B6340",
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
});
