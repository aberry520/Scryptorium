import {
  Animated,
  Alert,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "@/lib/supabase";

type LibraryBook = {
  library_id: number;
  user_id: string;
  username: string;
  notes: string | null;
  library_created_at: string;
  book_id: number;
  title: string;
  author: string;
  book_created_at: string;
};

type QRPayload = {
  type: "bookshelf_user";
  userId: string;
  name: string;
};

type LoanStep =
  | "idle" // book detail view
  | "scanning" // camera open, waiting for QR
  | "confirming" // scanned a valid user, show confirm screen
  | "loaning" // supabase calls in progress
  | "done"; // success

const SPINE_COLORS = [
  "#8B2E2E",
  "#2E5A8B",
  "#2E6B45",
  "#6B4C2E",
  "#5A2E6B",
  "#6B6B2E",
  "#2E6B6B",
  "#8B5A2E",
  "#3D2E8B",
  "#8B2E6B",
  "#2E4A2E",
  "#7A3B1E",
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BOOK_WIDTH = SCREEN_WIDTH * 0.78;
const BOOK_HEIGHT = SCREEN_HEIGHT * 0.62;

export function BookDetailModal({
  book,
  colorIndex,
  visible,
  onClose,
}: {
  book: LibraryBook | null;
  colorIndex: number;
  visible: boolean;
  onClose: () => void;
}) {
  // Cover flips open left-to-right (perspective fold on Y axis)
  const coverAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const [loanStep, setLoanStep] = useState<LoanStep>("idle");
  const [scannedUser, setScannedUser] = useState<QRPayload | null>(null);
  const [dueDate, setDueDate] = useState<string>(""); // "YYYY-MM-DD" or ""
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false); // prevent double-scan

  useEffect(() => {
    if (visible) {
      coverAnim.setValue(0);
      backdropAnim.setValue(0);
      contentAnim.setValue(0);
      setLoanStep("idle");
      setScannedUser(null);
      setDueDate("");
      scannedRef.current = false;

      Animated.sequence([
        // // Fade in backdrop first
        // Animated.timing(backdropAnim, {
        //   toValue: 1,
        //   duration: 200,
        //   useNativeDriver: true,
        // }),
        // Then swing cover open
        // Pause before anything starts
        Animated.delay(500),
        Animated.timing(coverAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Then fade in content
        Animated.timing(contentAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Snap everything back instantly when closing
      coverAnim.setValue(0);
      backdropAnim.setValue(0);
      contentAnim.setValue(0);
    }
  }, [visible]);

  if (!book) return null;

  const spineColor = SPINE_COLORS[colorIndex % SPINE_COLORS.length];

  // Interpolate cover rotation: 0deg (closed) → -170deg (flung open)
  const coverRotate = coverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-170deg"],
  });

  //   // Cover fades slightly as it opens so you see behind it
  //   const coverOpacity = coverAnim.interpolate({
  //     inputRange: [0, 0.6, 1],
  //     outputRange: [1, 0.9, 0.55],
  //   });

  // Cover casts a shadow that fades as it opens
  const shadowOpacity = coverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 0.1],
  });

  const addedDate = new Date(book.library_created_at).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );

  // ── Start loan flow ────────────────────────────────────────────────────────
  const handleLoanPress = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert(
          "Camera required",
          "Please allow camera access to scan a friend's QR code.",
        );
        return;
      }
    }
    scannedRef.current = false;
    setLoanStep("scanning");
  };

  // ── QR scanned ─────────────────────────────────────────────────────────────
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    try {
      const payload: QRPayload = JSON.parse(data);
      if (payload.type !== "bookshelf_user" || !payload.userId) {
        Alert.alert(
          "Invalid QR",
          "This doesn't look like a Bookshelf user code.",
        );
        scannedRef.current = false;
        return;
      }
      if (payload.userId === book.user_id) {
        Alert.alert("That's you!", "You can't loan a book to yourself.");
        scannedRef.current = false;
        return;
      }
      setScannedUser(payload);
      setLoanStep("confirming");
    } catch {
      Alert.alert("Invalid QR", "Could not read this QR code.");
      scannedRef.current = false;
    }
  };

  // ── Confirm loan ───────────────────────────────────────────────────────────
  const confirmLoan = async () => {
    if (!scannedUser) return;
    setLoanStep("loaning");

    try {
      const today = new Date().toISOString().split("T")[0];

      // 1. Always create a fresh library entry for the borrower —
      //    each loan needs its own row so loaned books can be greyed
      //    out independently on the lender's shelf later.
      const { data: newEntry, error: libraryError } = await supabase
        .from("library")
        .insert({ user_id: scannedUser.userId, book_id: book.book_id })
        .select("id")
        .single();
      if (libraryError) throw libraryError;

      // 2. Insert loan record, with optional due_date
      const { error: loanError } = await supabase.from("loans").insert({
        library_id: book.library_id, // lender's library entry
        borrower_user_id: scannedUser.userId,
        checkout_date: today,
        ...(dueDate ? { due_date: dueDate } : {}),
      });
      if (loanError) throw loanError;

      setLoanStep("done");
    } catch (e: any) {
      Alert.alert("Error recording loan", e.message);
      setLoanStep("confirming");
    }
  };

  // ── Interior content switcher ──────────────────────────────────────────────
  const renderInterior = () => {
    // Scanner view — full book interior replaced by camera
    if (loanStep === "scanning") {
      return (
        <View style={styles.scannerWrapper}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          {/* Viewfinder overlay */}
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerCornerTL} />
            <View style={styles.scannerCornerTR} />
            <View style={styles.scannerCornerBL} />
            <View style={styles.scannerCornerBR} />
          </View>
          <Text style={styles.scannerPrompt}>Scan friend's library code</Text>
          <TouchableOpacity
            style={styles.scanCancelBtn}
            onPress={() => setLoanStep("idle")}
          >
            <Text style={styles.scanCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Confirm screen
    if (loanStep === "confirming" && scannedUser) {
      // Build quick-pick options: 1 week, 2 weeks, 1 month, or clear
      const quickDates: { label: string; days: number }[] = [
        { label: "1 week", days: 7 },
        { label: "2 weeks", days: 14 },
        { label: "1 month", days: 30 },
      ];

      const pickQuickDate = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        setDueDate(d.toISOString().split("T")[0]);
      };

      const formatDueDisplay = (iso: string) => {
        if (!iso) return null;
        return new Date(iso).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      };

      return (
        <View style={styles.confirmWrapper}>
          <Text style={styles.chapterMark}>📖</Text>
          <Text style={styles.confirmHeading}>Loan this book?</Text>

          <View style={styles.confirmBookRow}>
            <Text style={styles.confirmBookTitle} numberOfLines={2}>
              {book.title}
            </Text>
            <Text style={styles.confirmBookAuthor}>{book.author}</Text>
          </View>

          <View style={styles.confirmArrow}>
            <Text style={styles.confirmArrowText}>↓</Text>
            <Text style={styles.confirmToLabel}>TO</Text>
          </View>

          <View style={styles.confirmFriendRow}>
            <Text style={styles.confirmFriendName}>{scannedUser.name}</Text>
          </View>

          {/* Optional due date */}
          <View style={styles.dueDateSection}>
            <Text style={styles.dueDateLabel}>
              DUE DATE <Text style={styles.dueDateOptional}>(optional)</Text>
            </Text>

            <View style={styles.quickDateRow}>
              {quickDates.map(({ label, days }) => {
                const iso = (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + days);
                  return d.toISOString().split("T")[0];
                })();
                const active = dueDate === iso;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.quickDateBtn,
                      active && styles.quickDateBtnActive,
                    ]}
                    onPress={() =>
                      active ? setDueDate("") : pickQuickDate(days)
                    }
                  >
                    <Text
                      style={[
                        styles.quickDateText,
                        active && styles.quickDateTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {dueDate ? (
              <Text style={styles.dueDateValue}>
                Return by {formatDueDisplay(dueDate)}
              </Text>
            ) : (
              <Text style={styles.dueDateNone}>No return date set</Text>
            )}
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={confirmLoan}>
            <Text style={styles.confirmBtnText}>CONFIRM LOAN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rescanBtn}
            onPress={() => {
              scannedRef.current = false;
              setLoanStep("scanning");
            }}
          >
            <Text style={styles.rescanText}>Scan again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeBtnSmall}
            onPress={() => setLoanStep("idle")}
          >
            <Text style={styles.closeBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Loaning in progress
    if (loanStep === "loaning") {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator color="#8B6340" size="large" />
          <Text style={styles.stateText}>Recording loan…</Text>
        </View>
      );
    }

    // Done
    if (loanStep === "done" && scannedUser) {
      return (
        <View style={styles.centeredState}>
          <Text style={styles.doneEmoji}>✓</Text>
          <Text style={styles.doneHeading}>Loaned!</Text>
          <Text style={styles.doneSubtext}>
            {book.title} has been loaned to {scannedUser.name}.
          </Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Default: book detail
    return (
      <Animated.View style={[styles.interiorContent, { opacity: contentAnim }]}>
        <Text style={styles.chapterMark}>❧</Text>

        <Text style={styles.interiorTitle} numberOfLines={3}>
          {book.title}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.interiorAuthor}>{book.author}</Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>ADDED TO LIBRARY</Text>
          <Text style={styles.metaValue}>{addedDate}</Text>
        </View>

        {book.notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.metaLabel}>MY NOTES</Text>
            <Text style={styles.notesText}>{book.notes}</Text>
          </View>
        ) : (
          <View style={styles.notesBlock}>
            <Text style={styles.metaLabel}>MY NOTES</Text>
            <Text style={styles.notesEmpty}>No notes yet.</Text>
          </View>
        )}

        {/* Action row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.loanBtn} onPress={handleLoanPress}>
            <Text style={styles.loanBtnText}>↗ LOAN TO FRIEND</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={loanStep === "idle" ? onClose : undefined}
          activeOpacity={1}
        />
      </Animated.View>

      <View style={styles.centreWrapper} pointerEvents="box-none">
        <View
          style={[
            styles.bookContainer,
            { width: BOOK_WIDTH, height: BOOK_HEIGHT },
          ]}
        >
          {/* Back cover / interior */}
          <View style={[styles.backCover, { backgroundColor: "#F5ECD7" }]}>
            {loanStep === "idle" &&
              Array.from({ length: 14 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pageLine,
                    { top: 48 + i * 30, opacity: i === 0 ? 0.08 : 0.06 },
                  ]}
                />
              ))}
            {renderInterior()}
          </View>

          {/* ── Spine strip on the left edge ── */}
          <View style={[styles.spineStrip, { backgroundColor: spineColor }]}>
            <View style={styles.spineStripHighlight} />
          </View>

          {/* ── Front cover — rotates open around the left edge ── */}
          <Animated.View
            style={[
              styles.frontCover,
              {
                backgroundColor: spineColor,
                // opacity: coverOpacity,
                transform: [
                  { perspective: 1200 },
                  { translateX: -BOOK_WIDTH / 2 }, // pivot around left edge
                  { rotateY: coverRotate },
                  { translateX: BOOK_WIDTH / 2 },
                ],
              },
            ]}
          >
            {/* Cover shadow overlay
            <Animated.View
              style={[styles.coverShadow, { opacity: shadowOpacity }]}
            /> */}

            {/* Cover decoration */}
            <View style={styles.coverBorderOuter}>
              <View style={styles.coverBorderInner} />
            </View>

            <View style={styles.coverTextBlock}>
              <Text style={styles.coverTitle} numberOfLines={4}>
                {book.title}
              </Text>
              <View style={styles.coverRule} />
              <Text style={styles.coverAuthor}>{book.author}</Text>
            </View>

            {/* Cover bottom band */}
            <View
              style={[
                styles.coverBand,
                { backgroundColor: "rgba(0,0,0,0.25)" },
              ]}
            />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const CORNER = 16;
const CORNER_W = 2.5;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.82)",
  },
  centreWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bookContainer: {
    position: "relative",
  },

  // ── Back / interior ──
  backCover: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    overflow: "hidden",
  },
  pageLine: {
    position: "absolute",
    left: 28,
    right: 20,
    height: 1,
    backgroundColor: "#8B7355",
  },
  interiorContent: {
    flex: 1,
    paddingTop: 36,
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  chapterMark: {
    fontSize: 20,
    color: "#8B6340",
    textAlign: "center",
    marginBottom: 12,
  },
  interiorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C1A0E",
    fontFamily: "Georgia",
    textAlign: "center",
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: "#C8A882",
    marginVertical: 12,
    marginHorizontal: 24,
  },
  interiorAuthor: {
    fontSize: 13,
    color: "#6B4C2E",
    fontFamily: "Georgia",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 18,
  },
  metaBlock: {
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#9A7A5A",
    fontWeight: "700",
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 13,
    color: "#3D2B1A",
    fontFamily: "Georgia",
  },
  notesBlock: {
    flex: 1,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 12,
    color: "#3D2B1A",
    fontFamily: "Georgia",
    lineHeight: 18,
    fontStyle: "italic",
  },
  notesEmpty: {
    fontSize: 12,
    color: "#B0956E",
    fontFamily: "Georgia",
    fontStyle: "italic",
  },

  // Action row at bottom of detail view
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  loanBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#8B6340",
    backgroundColor: "#8B6340",
    paddingVertical: 8,
    borderRadius: 2,
    alignItems: "center",
  },
  loanBtnText: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#F5ECD7",
    fontWeight: "700",
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: "#8B6340",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 2,
    alignItems: "center",
  },
  closeBtnSmall: {
    marginTop: 6,
    paddingVertical: 6,
  },
  closeBtnText: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#6B4C2E",
    fontWeight: "600",
  },

  // ── Scanner ──
  scannerWrapper: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  scannerOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 160,
    height: 160,
    marginTop: -80,
    marginLeft: -80,
  },
  scannerCornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CORNER,
    height: CORNER,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderColor: "#F5ECD7",
  },
  scannerCornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: CORNER,
    height: CORNER,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderColor: "#F5ECD7",
  },
  scannerCornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderColor: "#F5ECD7",
  },
  scannerCornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderColor: "#F5ECD7",
  },
  scannerPrompt: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#F5ECD7",
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: "Georgia",
    opacity: 0.85,
  },
  scanCancelBtn: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(245,236,215,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 2,
  },
  scanCancelText: {
    color: "#F5ECD7",
    fontSize: 11,
    letterSpacing: 1.5,
  },

  // ── Confirm ──
  confirmWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confirmHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C1A0E",
    fontFamily: "Georgia",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  confirmBookRow: {
    alignItems: "center",
    backgroundColor: "rgba(139,99,64,0.08)",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: "100%",
  },
  confirmBookTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2C1A0E",
    fontFamily: "Georgia",
    textAlign: "center",
  },
  confirmBookAuthor: {
    fontSize: 11,
    color: "#6B4C2E",
    fontStyle: "italic",
    fontFamily: "Georgia",
  },
  confirmArrow: {
    alignItems: "center",
  },
  confirmArrowText: {
    fontSize: 18,
    color: "#8B6340",
  },
  confirmToLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: "#9A7A5A",
    fontWeight: "700",
  },
  confirmFriendRow: {
    alignItems: "center",
    backgroundColor: "rgba(139,99,64,0.12)",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: "100%",
  },
  confirmFriendName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2C1A0E",
    fontFamily: "Georgia",
  },
  confirmBtn: {
    marginTop: 8,
    backgroundColor: "#8B6340",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 2,
    width: "100%",
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 11,
    letterSpacing: 2,
    color: "#F5ECD7",
    fontWeight: "700",
  },
  rescanBtn: {
    paddingVertical: 6,
  },
  rescanText: {
    fontSize: 11,
    color: "#8B6340",
    letterSpacing: 0.5,
    textDecorationLine: "underline",
  },

  // ── Due date picker ──
  dueDateSection: {
    width: "100%",
    marginTop: 4,
    marginBottom: 2,
    gap: 6,
  },
  dueDateLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#9A7A5A",
    fontWeight: "700",
  },
  dueDateOptional: {
    fontWeight: "400",
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  quickDateRow: {
    flexDirection: "row",
    gap: 6,
  },
  quickDateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C8A882",
    borderRadius: 2,
    paddingVertical: 6,
    alignItems: "center",
  },
  quickDateBtnActive: {
    backgroundColor: "#8B6340",
    borderColor: "#8B6340",
  },
  quickDateText: {
    fontSize: 10,
    color: "#6B4C2E",
    letterSpacing: 0.5,
  },
  quickDateTextActive: {
    color: "#F5ECD7",
    fontWeight: "700",
  },
  dueDateValue: {
    fontSize: 11,
    color: "#3D2B1A",
    fontFamily: "Georgia",
    fontStyle: "italic",
  },
  dueDateNone: {
    fontSize: 11,
    color: "#B0956E",
    fontFamily: "Georgia",
    fontStyle: "italic",
  },

  // ── Loading / Done ──
  centeredState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  stateText: {
    fontSize: 13,
    color: "#6B4C2E",
    fontFamily: "Georgia",
    fontStyle: "italic",
  },
  doneEmoji: {
    fontSize: 36,
    color: "#2E6B45",
  },
  doneHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C1A0E",
    fontFamily: "Georgia",
  },
  doneSubtext: {
    fontSize: 13,
    color: "#6B4C2E",
    fontFamily: "Georgia",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Spine ──
  spineStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 22,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    zIndex: 2,
  },
  spineStripHighlight: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },

  // ── Cover ──
  frontCover: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    zIndex: 3,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  coverBorderOuter: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 12,
    bottom: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 2,
  },
  coverBorderInner: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 1,
  },
  coverTextBlock: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  coverTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Georgia",
    textAlign: "center",
    letterSpacing: 1,
    lineHeight: 28,
    marginBottom: 14,
  },
  coverRule: {
    width: 48,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.45)",
    marginBottom: 12,
  },
  coverAuthor: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Georgia",
    fontStyle: "italic",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  coverBand: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
  },
});
