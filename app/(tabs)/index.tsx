import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BookSpine } from "@/components/BookSpine";
import { BookDetailModal } from "@/components/BookDetailModal";

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
  const [selectedBook, setSelectedBook] = useState<{
    book: LibraryBook;
    colorIndex: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
    );
  }, [books, searchQuery]);

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
        .from("user_library_books")
        .delete()
        .eq("library_id", libraryId);

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

  const isSearching = searchQuery.trim().length > 0;

  return (
    <View style={styles.room}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerText}>My Library</Text>
          <Text style={styles.bookCount}>
            {isSearching
              ? `${filteredBooks.length} of ${books.length}`
              : `${books.length} books`}
          </Text>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title or author…"
            placeholderTextColor="#6A5A4A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Bookshelf area */}
      <View style={styles.shelfWrapper}>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : filteredBooks.length === 0 ? (
          <Text style={styles.emptyText}>
            {isSearching
              ? `No books matching "${searchQuery}"`
              : "No books yet. Add some!"}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.spineRow}
            bounces={false}
            overScrollMode="never"
            scrollEventThrottle={16}
          >
            {filteredBooks.map((book) => (
              <BookSpine
                key={book.library_id}
                book={book}
                colorIndex={books.indexOf(book)} // keep colors stable regardless of filter
                onDelete={deleteBook}
                onPress={(b, ci) =>
                  setSelectedBook({ book: b, colorIndex: ci })
                }
                hidden={selectedBook?.book.library_id === book.library_id}
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

      <BookDetailModal
        book={selectedBook?.book ?? null}
        colorIndex={selectedBook?.colorIndex ?? 0}
        visible={selectedBook !== null}
        onClose={() => setSelectedBook(null)}
      />
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
    gap: 12,
  },
  headerTop: {
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A1E16",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3D2B1A",
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    color: "#F0E6D3",
    fontSize: 14,
    fontFamily: "Georgia",
    paddingVertical: 0,
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
