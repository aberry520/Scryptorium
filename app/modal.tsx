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
import { Mode, Book } from "@/types";

export default function ModalScreen() {
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);
  const [isbnLoading, setIsbnLoading] = useState(false);
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
          .from("books_with_authors")
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

  const addToLibrary = async (bookId: string) => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error("No user logged in");

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

      // Split "Frank Herbert" → first: "Frank", last: "Herbert"
      const parts = author.trim().split(" ");
      const firstName = parts.slice(0, -1).join(" ") || parts[0];
      const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

      // 1. Upsert the author (avoid duplicates)
      const { data: authorRow, error: authorError } = await supabase
        .from("authors")
        .upsert(
          { first_name: firstName, last_name: lastName },
          { onConflict: "first_name,last_name" },
        )
        .select()
        .single();
      if (authorError) throw authorError;

      // 2. Insert the book into books_v2
      const { data: book, error: bookError } = await supabase
        .from("books_v2")
        .insert({ title: query.trim() })
        .select()
        .single();
      if (bookError) throw bookError;

      // 3. Link book and author in join table
      const { error: joinError } = await supabase
        .from("book_authors")
        .insert({ book_id: book.id, author_id: authorRow.id, author_order: 1 });
      if (joinError) throw joinError;

      // 4. Add to user's library
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

  const lookupByIsbn = async () => {
    if (isbn.trim().length < 10) {
      Alert.alert("Error", "Please enter a valid ISBN (10 or 13 digits).");
      return;
    }

    setIsbnLoading(true);
    try {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn.trim()}&format=json&jscmd=data`,
      );
      const data = await res.json();
      const bookData = data[`ISBN:${isbn.trim()}`];

      if (!bookData) {
        Alert.alert(
          "Not found",
          "No book found for that ISBN. Try filling in the details manually.",
        );
        return;
      }

      // Pre-fill title and author from the API response
      setQuery(bookData.title || "");
      setAuthor(bookData.authors?.[0]?.name || "");
      setIsbn("");
    } catch (e: any) {
      Alert.alert("Error", "ISBN lookup failed. Please try again.");
    } finally {
      setIsbnLoading(false);
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
    setIsbn("");
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

        {/* ISBN auto-fill */}
        <ThemedView style={styles.isbnRow}>
          <ThemedTextInput
            placeholder="ISBN (optional auto-fill)"
            value={isbn}
            onChangeText={setIsbn}
            style={styles.isbnInput}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={styles.isbnBtn}
            onPress={lookupByIsbn}
            disabled={isbnLoading}
          >
            {isbnLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <ThemedText type="link">Look up</ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>

        <ThemedText style={styles.divider}>— or fill in manually —</ThemedText>

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
  isbnRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 10,
    gap: 8,
  },
  isbnInput: {
    flex: 1,
  },
  isbnBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  divider: {
    opacity: 0.4,
    fontSize: 12,
    marginVertical: 6,
  },
});
