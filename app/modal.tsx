import { Link, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";
import { Mode, Book } from "@/types";

type ResultSource = "local" | "external";
type SearchResult = Book & { source: ResultSource };

type OpenLibraryBook = {
  title: string;
  author_name?: string[];
  isbn?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

export default function ModalScreen() {
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const [mode, setMode] = useState<Mode>("search");
  const [loading, setLoading] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search both local DB and Open Library as user types
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
        // Run local and external searches in parallel
        const [localResults, externalResults] = await Promise.all([
          searchLocal(query.trim()),
          searchOpenLibrary(query.trim()),
        ]);

        // Local results first, then dedupe external against local ISBNs
        const localIds = new Set(
          localResults.map((b) => b.isbn_13 ?? b.isbn_10),
        );
        const dedupedExternal = externalResults.filter(
          (b) => !localIds.has(b.isbn_13 ?? b.isbn_10),
        );

        setResults([...localResults, ...dedupedExternal]);
      } catch (e: any) {
        console.error("Search error:", e.message);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query, mode]);

  const searchLocal = async (q: string): Promise<SearchResult[]> => {
    const { data, error } = await supabase
      .from("books_with_authors")
      .select("*")
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
      .limit(5);
    if (error) throw new Error(`localSearchError: ${error.message}`);
    return (data || []).map((b: Book) => ({
      ...b,
      source: "local" as ResultSource,
    }));
  };

  const searchOpenLibrary = async (q: string): Promise<SearchResult[]> => {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=title,author_name,isbn,first_publish_year,cover_i`,
    );
    const data = await res.json();
    return (data.docs || []).map((doc: OpenLibraryBook, i: number) => ({
      id: `ext-${i}`,
      source: "external" as ResultSource,
      title: doc.title,
      author: doc.author_name?.[0] ?? "Unknown",
      subtitle: null,
      isbn_13: doc.isbn?.find((s: string) => s.length === 13) ?? null,
      isbn_10: doc.isbn?.find((s: string) => s.length === 10) ?? null,
      published_at: doc.first_publish_year
        ? String(doc.first_publish_year)
        : null,
      cover_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      external_source: "open_library",
      external_id: doc.isbn?.[0] ?? null,
      created_at: new Date().toISOString(),
    }));
  };

  const searchByIsbn = async (isbn: string) => {
    setSearching(true);
    try {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      );
      const data = await res.json();
      const bookData = data[`ISBN:${isbn}`];

      if (!bookData) {
        Alert.alert("Not found", "No book found for that ISBN.");
        return;
      }

      const result: SearchResult = {
        id: `ext-isbn-${isbn}`,
        source: "external",
        title: bookData.title ?? "",
        author: bookData.authors?.[0]?.name ?? "Unknown",
        subtitle: bookData.subtitle ?? null,
        isbn_13: isbn.length === 13 ? isbn : null,
        isbn_10: isbn.length === 10 ? isbn : null,
        published_at: bookData.publish_date ?? null,
        cover_url: bookData.cover?.medium ?? null,
        external_source: "open_library",
        external_id: isbn,
        created_at: new Date().toISOString(),
      };

      setSelectedBook(result);
      setMode("confirm-existing");
    } catch (e: any) {
      Alert.alert("Error", "ISBN lookup failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleScanPress = () => {
    // TODO: wire up your barcode scanner here
    // e.g. router.push("/scan") or open a camera modal
    // On scan success, call: searchByIsbn(scannedIsbn)
    Alert.alert("Scan ISBN", "Wire up your barcode scanner here.");
  };

  const addToLibrary = async (bookId: string) => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user)
        throw (
          new Error(`userError: ${userError?.message}`) ||
          new Error("No user logged in")
        );

      const { error: libraryError } = await supabase
        .from("library")
        .insert({ book_id: bookId, user_id: user.id });
      if (libraryError)
        throw new Error(`libraryError: ${libraryError.message}`);

      Alert.alert("Added!", "Book added to your library.");
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Library Add Error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  // Import an external book into books_v2 then add to library
  const importAndAdd = async (book: SearchResult) => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user)
        throw (
          new Error(`userError: ${userError?.message}`) ||
          new Error("No user logged in")
        );

      // Split "Frank Herbert" → first: "Frank", last: "Herbert"
      const parts = book.author.trim().split(" ");
      const firstName = parts.slice(0, -1).join(" ") || parts[0];
      const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

      // 1. Upsert author
      const { data: authorRow, error: authorError } = await supabase
        .from("authors")
        .upsert(
          { first_name: firstName, last_name: lastName },
          { onConflict: "first_name,last_name" },
        )
        .select()
        .single();
      if (authorError) throw new Error(`authorError: ${authorError.message}`);

      // 2. Insert book into books_v2
      const { data: newBook, error: bookError } = await supabase
        .from("books_v2")
        .insert({
          title: book.title,
          subtitle: book.subtitle,
          isbn_10: book.isbn_10,
          isbn_13: book.isbn_13,
          published_at: book.published_at,
          cover_url: book.cover_url,
          external_source: book.external_source,
          external_id: book.external_id,
        })
        .select()
        .single();
      if (bookError) throw new Error(`bookError: ${bookError.message} `);

      // 3. Link book and author
      const { error: joinError } = await supabase.from("book_authors").insert({
        book_id: newBook.id,
        author_id: authorRow.id,
        author_order: 1,
      });
      if (joinError) throw new Error(`joinError: ${joinError.message}`);

      // 4. Add to library
      const { error: libraryError } = await supabase
        .from("library")
        .insert({ book_id: newBook.id, user_id: user.id });
      if (libraryError)
        throw new Error(`libraryError: ${libraryError.message}`);

      Alert.alert("Added!", "Book imported and added to your library.");
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Import to Library Error:", e.message);
      console.log(book);
      console.error("Import to Library Error:", e.message);
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
      if (userError || !user)
        throw (
          new Error(`userError: ${userError?.message}`) ||
          new Error("No user logged in")
        );

      const parts = author.trim().split(" ");
      const firstName = parts.slice(0, -1).join(" ") || parts[0];
      const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

      const { data: authorRow, error: authorError } = await supabase
        .from("authors")
        .upsert(
          { first_name: firstName, last_name: lastName },
          { onConflict: "first_name,last_name" },
        )
        .select()
        .single();
      if (authorError) throw new Error(`authorError: ${authorError.message}`);

      const { data: book, error: bookError } = await supabase
        .from("books_v2")
        .insert({ title: query.trim() })
        .select()
        .single();
      if (bookError) throw new Error(`bookError: ${bookError.message}`);

      const { error: joinError } = await supabase
        .from("book_authors")
        .insert({ book_id: book.id, author_id: authorRow.id, author_order: 1 });
      if (joinError) throw new Error(`joinError: ${joinError.message}`);

      const { error: libraryError } = await supabase
        .from("library")
        .insert({ book_id: book.id, user_id: user.id });
      if (libraryError)
        throw new Error(`libraryError: ${libraryError.message}`);

      Alert.alert("Added!", "Book created and added to your library.");
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Import Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = (book: SearchResult) => {
    setSelectedBook(book);
    setMode("confirm-existing");
  };

  const handleConfirm = () => {
    if (!selectedBook) return;
    if (selectedBook.source === "local") {
      addToLibrary(selectedBook.id);
    } else {
      importAndAdd(selectedBook);
    }
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

  // ── Confirm book (local or external) ──────────────────────────────────────
  if (mode === "confirm-existing" && selectedBook) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Add to Library?</ThemedText>

        {selectedBook.source === "external" && (
          <ThemedText style={styles.externalBadge}>
            📚 From Open Library
          </ThemedText>
        )}

        <ThemedView style={styles.bookCard}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            {selectedBook.title}
          </ThemedText>
          <ThemedText style={styles.cardAuthor}>
            {selectedBook.author}
          </ThemedText>
          {selectedBook.published_at && (
            <ThemedText style={styles.cardMeta}>
              {selectedBook.published_at}
            </ThemedText>
          )}
          {selectedBook.isbn_13 && (
            <ThemedText style={styles.cardMeta}>
              ISBN: {selectedBook.isbn_13}
            </ThemedText>
          )}
        </ThemedView>

        <Button
          title={loading ? "Adding…" : "Add to My Library"}
          onPress={handleConfirm}
          disabled={loading}
        />

        <TouchableOpacity onPress={handleBack} style={styles.secondaryBtn}>
          <ThemedText type="link">← Back to search</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // ── Manual create fallback ─────────────────────────────────────────────────
  if (mode === "create-new") {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Add Manually</ThemedText>
        <ThemedText style={styles.subtitle}>
          Can't find it? Fill in the details and we'll add it for everyone.
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
  const localResults = results.filter((r) => r.source === "local");
  const externalResults = results.filter((r) => r.source === "external");

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.searchHeader}>
        <ThemedText type="title" style={styles.searchTitle}>
          Add a Book
        </ThemedText>

        {/* Search input with barcode scanner icon */}
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Search by title or author…"
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setResults([]);
            }}
            style={styles.searchInput}
            autoFocus
          />
          <TouchableOpacity onPress={handleScanPress} style={styles.scanBtn}>
            <Ionicons name="barcode-outline" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {searching && <ActivityIndicator style={styles.spinner} />}
      </ThemedView>

      {/* Results list with section labels */}
      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            localResults.length > 0 ? (
              <ThemedText style={styles.sectionLabel}>
                In your database
              </ThemedText>
            ) : null
          }
          renderItem={({ item, index }) => {
            const isFirstExternal =
              item.source === "external" &&
              (index === 0 || results[index - 1].source === "local");
            return (
              <>
                {isFirstExternal && (
                  <ThemedText style={styles.sectionLabel}>
                    From Open Library
                  </ThemedText>
                )}
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => handleSelectResult(item)}
                >
                  <ThemedText type="defaultSemiBold" numberOfLines={1}>
                    {item.title}
                  </ThemedText>
                  <ThemedText style={styles.resultAuthor} numberOfLines={1}>
                    {item.author}
                    {item.published_at ? `  ·  ${item.published_at}` : ""}
                  </ThemedText>
                </TouchableOpacity>
              </>
            );
          }}
        />
      )}

      {/* Manual fallback */}
      {query.trim().length >= 2 && !searching && (
        <TouchableOpacity onPress={handleNoMatch} style={styles.notFoundBtn}>
          <ThemedText type="link">
            {results.length === 0
              ? "Nothing found — add manually"
              : "Don't see it? Add manually"}
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.4)",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginVertical: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  scanBtn: {
    paddingLeft: 10,
    paddingVertical: 10,
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
    maxHeight: 380,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingVertical: 6,
    paddingHorizontal: 4,
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
  cardMeta: {
    fontSize: 12,
    opacity: 0.45,
    marginTop: 4,
  },
  externalBadge: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
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
