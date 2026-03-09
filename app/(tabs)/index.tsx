import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dimensions,
  ScrollView,
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

function BookSpine({
  book,
  colorIndex,
}: {
  book: LibraryBook;
  colorIndex: number;
}) {
  const color = SPINE_COLORS[colorIndex % SPINE_COLORS.length];
  // Slightly vary heights for realism
  const heightVariance = ((book.book_id * 37) % 60) - 20;
  const spineHeight = Math.min(
    SHELF_HEIGHT - 40,
    Math.max(SHELF_HEIGHT - 120, SHELF_HEIGHT - 60 + heightVariance),
  );

  const textWidth = SHELF_HEIGHT - 20; // was spineHeight - 20, but it wasn't working due to expo/react native timing of when dimensions are calculated, so using shelf height which is constant instead of spine height which is variable

  return (
    <TouchableOpacity
      activeOpacity={0.75}
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

export default function HomeScreen() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLibraryBooks = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not logged in");

      const { data, error } = await supabase
        .from("user_library_books")
        .select("*")
        .eq("user_id", user.id)
        .order("library_created_at", { ascending: false });

      if (error) throw error;
      setBooks(data || []);
    } catch (error: any) {
      Alert.alert("Error fetching library", error.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLibraryBooks();
    setRefreshing(false);
  };

  useEffect(() => {
    const load = async () => {
      await fetchLibraryBooks();
      setLoading(false);
    };
    load();
  }, []);

  return (
    <View style={styles.room}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>My Library</Text>
        <Text style={styles.bookCount}>{books.length} books</Text>
      </View>

      {/* Bookshelf area */}
      <View style={styles.shelfWrapper}>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : books.length === 0 ? (
          <Text style={styles.emptyText}>No books yet. Add some!</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            // refreshControl={
            //   <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            // }
            contentContainerStyle={styles.spineRow}
            bounces={false} // disable the vertical bounce
            overScrollMode="never" // Android only
            scrollEventThrottle={16} // smoother scroll event handling
          >
            {books.map((book, i) => (
              <BookSpine key={book.book_id} book={book} colorIndex={i} />
            ))}
          </ScrollView>
        )}

        {/* Shelf plank */}
        <View style={styles.shelfPlank}>
          <View style={styles.shelfEdge} />
        </View>
      </View>

      {/* Wall texture behind shelf */}
      <View style={styles.wall} />

      <View style={styles.footer}>
        <Button title="＋  Add Book" onPress={() => router.push("/modal")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  room: {
    flex: 1,
    backgroundColor: "#1A1210",
  },
  wall: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1A1210",
    zIndex: -1,
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  headerText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F0E6D3",
    letterSpacing: 1,
    fontFamily: "Georgia",
  },
  bookCount: {
    fontSize: 14,
    color: "#9A8A78",
    fontStyle: "italic",
  },
  shelfWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  spineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 0,
    gap: 3,
  },
  spine: {
    width: SPINE_WIDTH,
    borderRadius: 2,
    // removed overflow: "hidden" so author is never clipped
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
  shelfPlank: {
    height: 18,
    backgroundColor: "#5C3D1E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
    borderTopWidth: 2,
    borderTopColor: "#7A5230",
  },
  shelfEdge: {
    height: 4,
    backgroundColor: "#8B6340",
  },
  emptyText: {
    color: "#9A8A78",
    textAlign: "center",
    marginTop: 40,
    fontStyle: "italic",
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
});
