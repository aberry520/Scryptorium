import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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

// A warm, varied palette of book spine colors
const SPINE_COLORS = [
  "#8B2E2E", // deep red
  "#2E5A8B", // navy blue
  "#2E6B45", // forest green
  "#6B4C2E", // warm brown
  "#5A2E6B", // plum purple
  "#6B6B2E", // olive
  "#2E6B6B", // teal
  "#8B5A2E", // caramel
  "#3D2E8B", // indigo
  "#8B2E6B", // burgundy rose
  "#2E4A2E", // dark green
  "#7A3B1E", // rust
];

const SPINE_WIDTH = 48;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHELF_HEIGHT = SCREEN_HEIGHT * 0.62;

export function BookSpine({
  book,
  colorIndex,
  onDelete,
  onPress,
}: {
  book: LibraryBook;
  colorIndex: number;
  onDelete: (libraryId: number) => Promise<void>;
  onPress: (book: LibraryBook, colorIndex: number) => void;
}) {
  const color = SPINE_COLORS[colorIndex % SPINE_COLORS.length];
  // Slightly vary heights for realism
  const heightVariance = ((book.book_id * 37) % 60) - 20;
  const spineHeight = Math.min(
    SHELF_HEIGHT - 40,
    Math.max(SHELF_HEIGHT - 120, SHELF_HEIGHT - 60 + heightVariance),
  );

  const textWidth = SHELF_HEIGHT - 20;

  const handleLongPress = () => {
    Alert.alert(
      "Remove from Library",
      `Remove "${book.title}" from your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onDelete(book.library_id),
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(book, colorIndex)}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={[styles.spine, { backgroundColor: color, height: spineHeight }]}
    >
      {/* Top decorative band */}
      <View
        style={[styles.topBand, { backgroundColor: "rgba(255,255,255,0.15)" }]}
      />

      {/* Rotated title */}
      <View style={styles.spineMid}>
        <View
          style={[
            styles.rotatedContainer,
            { width: textWidth, height: SPINE_WIDTH },
          ]}
        >
          <Text
            style={styles.spineTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {book.title.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Author flat at bottom */}
      <View style={styles.spineAuthorContainer}>
        <Text style={styles.spineAuthor} numberOfLines={2} ellipsizeMode="tail">
          {book.author.split(" ").slice(-1)[0]}
        </Text>
      </View>

      {/* Bottom decorative band */}
      <View
        style={[styles.bottomBand, { backgroundColor: "rgba(0,0,0,0.2)" }]}
      />

      {/* Spine highlight */}
      <View style={styles.spineHighlight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  spine: {
    width: SPINE_WIDTH,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  topBand: {
    width: "100%",
    height: 18,
  },
  spineMid: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    width: "100%",
  },
  rotatedContainer: {
    transform: [{ rotate: "-90deg" }],
    justifyContent: "center",
    alignItems: "center",
  },
  spineTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textAlign: "center",
    fontFamily: "Georgia",
  },
  spineAuthorContainer: {
    width: SPINE_WIDTH,
    alignItems: "center",
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  spineAuthor: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 7,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  bottomBand: {
    width: "100%",
    height: 14,
  },
  spineHighlight: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
  },
});
