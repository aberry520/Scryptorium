import { Link, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

type Book = {
  id: number;
  title: string;
  author: string;
  created_at: string;
};

type Mode = "search" | "confirm-existing" | "create-new";

export default function ModalScreen() {
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [mode, setMode] = useState<Mode>("search");
  const [loading, setLoading] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search books as user types
  useEffect(() => {
    if (mode !== "search") return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from("books")
          .select("*")
          .or(`title.ilike.%${query.trim()}%,author.ilike.%${query.trim()}%`)
          .limit(8);

        if (error) throw error;
        setResults(data || []);
      } catch (e: any) {
        console.error("Search error:", e.message);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query, mode]);

  const addToLibrary = async (bookId: number) => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error("No user logged in");

      // // Check if already in library
      // const { data: existing } = await supabase
      //   .from("library")
      //   .select("id")
      //   .eq("book_id", bookId)
      //   .eq("user_id", user.id)
      //   .maybeSingle();

      // if (existing) {
      //   Alert.alert(
      //     "Already in library",
      //     "You already have this book in your library.",
      //   );
      //   return;
      // }

      const { error: libraryError } = await supabase
        .from("library")
        .insert({ book_id: bookId, user_id: user.id });
      if (libraryError) throw libraryError;

      Alert.alert("Added!", "Book added to your library.");
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const createAndAdd = async () => {
    if (!query.trim() || !author.trim()) {
      Alert.alert("Error", "Please enter both title and author.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error("No user logged in");

      const { data: book, error: booksError } = await supabase
        .from("books")
        .insert({ title: query.trim(), author: author.trim() })
        .select()
        .single();
      if (booksError) throw booksError;

      const { error: libraryError } = await supabase
        .from("library")
        .insert({ book_id: book.id, user_id: user.id });
      if (libraryError) throw libraryError;

      Alert.alert("Added!", "Book created and added to your library.");
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExisting = (book: Book) => {
    setSelectedBook(book);
    setMode("confirm-existing");
  };

  const handleNoMatch = () => {
    setMode("create-new");
  };

  const handleBack = () => {
    setSelectedBook(null);
    setMode("search");
    setAuthor("");
    setResults([]);
  };

  // ── Confirm existing book ──────────────────────────────────────────────────
  if (mode === "confirm-existing" && selectedBook) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Add to Library?</ThemedText>

        <ThemedView style={styles.bookCard}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            {selectedBook.title}
          </ThemedText>
          <ThemedText style={styles.cardAuthor}>
            {selectedBook.author}
          </ThemedText>
        </ThemedView>

        <Button
          title={loading ? "Adding…" : "Add to My Library"}
          onPress={() => addToLibrary(selectedBook.id)}
          disabled={loading}
        />

        <TouchableOpacity onPress={handleBack} style={styles.secondaryBtn}>
          <ThemedText type="link">← Back to search</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // ── Create new book ────────────────────────────────────────────────────────
  if (mode === "create-new") {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">New Book</ThemedText>
        <ThemedText style={styles.subtitle}>
          This book isn't in our database yet. Fill in the details and we'll add
          it for everyone.
        </ThemedText>

        <ThemedTextInput
          placeholder="Book Title"
          value={query}
          onChangeText={setQuery}
          style={styles.input}
        />
        <ThemedTextInput
          placeholder="Author"
          value={author}
          onChangeText={setAuthor}
          style={styles.input}
          autoFocus
        />

        <Button
          title={loading ? "Adding…" : "Add to Library"}
          onPress={createAndAdd}
          disabled={loading}
        />

        <TouchableOpacity onPress={handleBack} style={styles.secondaryBtn}>
          <ThemedText type="link">← Back to search</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  return (
    <ThemedView style={styles.container}>
      {/* Fixed top section */}
      <ThemedView style={styles.searchHeader}>
        <ThemedText type="title" style={styles.searchTitle}>
          Add a Book
        </ThemedText>

        <ThemedTextInput
          placeholder="Search by title or author…"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setResults([]);
          }}
          style={styles.input}
          autoFocus
        />

        {searching && <ActivityIndicator style={styles.spinner} />}
      </ThemedView>

      {/* Scrollable results */}
      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => handleSelectExisting(item)}
            >
              <ThemedText type="defaultSemiBold" numberOfLines={1}>
                {item.title}
              </ThemedText>
              <ThemedText style={styles.resultAuthor} numberOfLines={1}>
                {item.author}
              </ThemedText>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Show "not here" option once user has typed enough and search settled */}
      {query.trim().length >= 2 && !searching && (
        <TouchableOpacity onPress={handleNoMatch} style={styles.notFoundBtn}>
          <ThemedText type="link">
            {results.length === 0
              ? "No results — add a new book"
              : "Don't see it? Add a new book"}
          </ThemedText>
        </TouchableOpacity>
      )}

      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">Cancel</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 20,
    paddingTop: 60,
  },
  searchHeader: {
    width: "100%",
    alignItems: "center",
    marginBottom: 4,
  },
  searchTitle: {
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.65,
    marginBottom: 8,
    fontSize: 13,
  },
  input: {
    width: "100%",
    marginVertical: 10,
  },
  spinner: {
    marginTop: 8,
  },
  list: {
    width: "100%",
    maxHeight: 280,
    marginTop: 4,
  },
  resultRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.25)",
    width: "100%",
  },
  resultAuthor: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  notFoundBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  bookCard: {
    width: "100%",
    padding: 20,
    borderRadius: 10,
    marginVertical: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.3)",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 6,
  },
  cardAuthor: {
    fontSize: 14,
    opacity: 0.65,
    fontStyle: "italic",
  },
  secondaryBtn: {
    marginTop: 20,
    paddingVertical: 10,
  },
  link: {
    marginTop: 20,
    paddingVertical: 10,
  },
});
