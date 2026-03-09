import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BookSpine } from "@/components/BookSpine";

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

  const deleteBook = async (libraryId: number) => {
    try {
      const { error } = await supabase
        .from("library")
        .delete()
        .eq("id", libraryId);

      if (error) throw error;
      setBooks((prev) => prev.filter((b) => b.library_id !== libraryId));
    } catch (error: any) {
      Alert.alert("Error removing book", error.message);
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
              <BookSpine
                key={book.book_id}
                book={book}
                colorIndex={i}
                onDelete={deleteBook}
              />
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
