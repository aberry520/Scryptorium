import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (visible) {
      coverAnim.setValue(0);
      backdropAnim.setValue(0);
      contentAnim.setValue(0);

      Animated.sequence([
        // // Fade in backdrop first
        // Animated.timing(backdropAnim, {
        //   toValue: 1,
        //   duration: 200,
        //   useNativeDriver: true,
        // }),
        // Then swing cover open
        Animated.timing(coverAnim, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Then fade in content
        Animated.timing(contentAnim, {
          toValue: 1,
          duration: 260,
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

  // Cover fades slightly as it opens so you see behind it
  const coverOpacity = coverAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 0.9, 0.55],
  });

  // Cover casts a shadow that fades as it opens
  const shadowOpacity = coverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 0.1],
  });

  const addedDate = new Date(book.library_created_at).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );

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
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Book container — centred on screen */}
      <View style={styles.centreWrapper} pointerEvents="box-none">
        <View
          style={[
            styles.bookContainer,
            { width: BOOK_WIDTH, height: BOOK_HEIGHT },
          ]}
        >
          {/* ── Back cover / interior pages (always visible underneath) ── */}
          <View style={[styles.backCover, { backgroundColor: "#F5ECD7" }]}>
            {/* Page lines texture */}
            {Array.from({ length: 14 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pageLine,
                  { top: 48 + i * 30, opacity: i === 0 ? 0.08 : 0.06 },
                ]}
              />
            ))}

            {/* Interior content */}
            <Animated.View
              style={[styles.interiorContent, { opacity: contentAnim }]}
            >
              {/* Decorative chapter mark */}
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

              {/* Close button */}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </Animated.View>
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
                opacity: coverOpacity,
                transform: [
                  { perspective: 1200 },
                  { translateX: -BOOK_WIDTH / 2 }, // pivot around left edge
                  { rotateY: coverRotate },
                  { translateX: BOOK_WIDTH / 2 },
                ],
              },
            ]}
          >
            {/* Cover shadow overlay */}
            <Animated.View
              style={[styles.coverShadow, { opacity: shadowOpacity }]}
            />

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
    fontSize: 22,
    color: "#8B6340",
    textAlign: "center",
    marginBottom: 16,
  },
  interiorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2C1A0E",
    fontFamily: "Georgia",
    textAlign: "center",
    lineHeight: 30,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: "#C8A882",
    marginVertical: 14,
    marginHorizontal: 24,
  },
  interiorAuthor: {
    fontSize: 14,
    color: "#6B4C2E",
    fontFamily: "Georgia",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 24,
  },
  metaBlock: {
    marginBottom: 16,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#9A7A5A",
    fontWeight: "700",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: "#3D2B1A",
    fontFamily: "Georgia",
  },
  notesBlock: {
    flex: 1,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 13,
    color: "#3D2B1A",
    fontFamily: "Georgia",
    lineHeight: 20,
    fontStyle: "italic",
  },
  notesEmpty: {
    fontSize: 13,
    color: "#B0956E",
    fontFamily: "Georgia",
    fontStyle: "italic",
  },
  closeBtn: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#8B6340",
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 2,
  },
  closeBtnText: {
    fontSize: 12,
    letterSpacing: 2,
    color: "#6B4C2E",
    fontWeight: "600",
  },

  // ── Spine strip ──
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

  // ── Front cover ──
  frontCover: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    zIndex: 3,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  coverShadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
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
