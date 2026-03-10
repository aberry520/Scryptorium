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
import { LibraryBook, ActiveLoan, BorrowedLoan } from "@/types";

export default function HomeScreen() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  // keyed by this user's library_id
  const [activeLoans, setActiveLoans] = useState<Record<string, ActiveLoan>>(
    {},
  );
  const [borrowedLoans, setBorrowedLoans] = useState<
    Record<string, BorrowedLoan>
  >({});
  const [loading, setLoading] = useState(true);
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
      return { user, books: data || [] };
    } catch (error: any) {
      Alert.alert("Error fetching library", error.message);
      return null;
    }
  };

  // Loans the user has given out (they are the lender)
  const fetchActiveLoans = async (libraryIds: string[]) => {
    if (libraryIds.length === 0) return;
    try {
      // Fetch loans with no return_date (still out) for this user's library entries
      const { data, error } = await supabase
        .from("loans")
        .select("id, library_id, borrower_user_id, checkout_date, due_date")
        .in("library_id", libraryIds)
        .is("return_date", null);

      if (error) throw error;
      if (!data || data.length === 0) return;

      // Fetch borrower names from profiles
      const borrowerIds = [...new Set(data.map((l) => l.borrower_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", borrowerIds);

      const nameMap: Record<string, string | null> = {};
      profiles?.forEach((p) => {
        nameMap[p.id] = p.name;
      });

      const loanMap: Record<string, ActiveLoan> = {};
      data.forEach((l) => {
        loanMap[l.library_id] = {
          loan_id: l.id,
          borrower_user_id: l.borrower_user_id,
          borrower_name: nameMap[l.borrower_user_id] ?? null,
          checkout_date: l.checkout_date,
          due_date: l.due_date,
        };
      });
      setActiveLoans(loanMap);
    } catch (error: any) {
      console.error("Error fetching active loans:", error.message);
    }
  };

  // Loans the user has received (they are the borrower)
  const fetchBorrowedLoans = async (userId: string, libraryIds: string[]) => {
    if (libraryIds.length === 0) return;
    try {
      // Find loans where this user is the borrower AND the library entry
      // is one of their own library rows (the one created when the book was loaned to them)
      const { data, error } = await supabase
        .from("loans")
        .select("id, library_id, borrower_user_id, checkout_date, due_date")
        .eq("borrower_user_id", userId)
        .in("library_id", libraryIds) // will not match — lender's library_id
        .is("return_date", null);

      // The above won't work directly because library_id is the LENDER's entry.
      // Instead, query all active loans where this user is borrower, then cross-ref.
      const { data: borrowedData, error: borrowedError } = await supabase
        .from("loans")
        .select("id, library_id, borrower_user_id, checkout_date, due_date")
        .eq("borrower_user_id", userId)
        .is("return_date", null);

      if (borrowedError) throw borrowedError;
      if (!borrowedData || borrowedData.length === 0) return;

      // For each borrowed loan, get the lender's user_id via library table
      const lenderLibraryIds = borrowedData.map((l) => l.library_id);
      const { data: lenderEntries } = await supabase
        .from("library")
        .select("id, user_id")
        .in("id", lenderLibraryIds);

      const lenderUserIds = [
        ...new Set(lenderEntries?.map((e) => e.user_id) ?? []),
      ];
      const { data: lenderProfiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", lenderUserIds);

      const nameMap: Record<string, string | null> = {};
      lenderProfiles?.forEach((p) => {
        nameMap[p.id] = p.name;
      });

      const lenderMap: Record<string, string> = {}; // library_id → user_id
      lenderEntries?.forEach((e) => {
        lenderMap[e.id] = e.user_id;
      });

      // Map borrowed loans to the borrower's own library_id
      // The borrower's library entry was created during loan — find by book matching
      // We store by the borrower's library_id for easy lookup from the shelf
      const borrowMap: Record<string, BorrowedLoan> = {};
      borrowedData.forEach((l) => {
        const lenderUserId = lenderMap[l.library_id];
        // Find the borrower's own library entry for this loan
        // We use the loan_id as a fallback key mapped to the library entry
        // For now, key by the borrower's library_id found in their books list
        // We'll do a secondary lookup: find the library entry created for the borrower
        // that matches. Since we always create a new row, we use loan.id as unique ref.
        // We'll store temporarily and reconcile below.
        borrowMap[l.library_id] = {
          loan_id: l.id,
          lender_library_id: l.library_id,
          lender_user_id: lenderUserId ?? "",
          lender_name: lenderUserId ? (nameMap[lenderUserId] ?? null) : null,
          checkout_date: l.checkout_date,
          due_date: l.due_date,
        };
      });

      // Now reconcile: we need to find the borrower's library_id for each loan.
      // The borrower's library entry was created right before the loan insert.
      // We can find it by: library.user_id = currentUser, book_id matches, created
      // around the same time. Best approach: store loan_id on library, but since
      // we don't have that column, we fetch all of the borrower's library entries
      // for the relevant books and match by proximity to checkout_date.
      // Simpler: the borrowerData loan.library_id IS the lender's library_id —
      // map by lender's library_id and let the modal use it for the return scan.
      // The spine keying is by the borrower's library_id so we need to find that.
      // Query: library entries for this user that were created on/after checkout dates.
      const bookIdsInLoans = new Set(
        (lenderEntries ?? []).map(() => null), // we don't have book_id here yet
      );

      // Fetch lender library entries to get book_ids
      const { data: lenderLibDetails } = await supabase
        .from("library")
        .select("id, book_id, user_id")
        .in("id", lenderLibraryIds);

      // Build lender libraryId → book_id map
      const lenderBookMap: Record<string, string> = {};
      lenderLibDetails?.forEach((e) => {
        lenderBookMap[e.id] = e.book_id;
      });

      // Now find the borrower's library entries for those book_ids
      const relevantBookIds = Object.values(lenderBookMap);
      if (relevantBookIds.length === 0) return;

      const { data: borrowerLibEntries } = await supabase
        .from("library")
        .select("id, book_id, created_at")
        .eq("user_id", userId)
        .in("book_id", relevantBookIds);

      // Match borrower library entry to loan by book_id + closest created_at to checkout
      const finalBorrowMap: Record<string, BorrowedLoan> = {};
      borrowedData.forEach((loan) => {
        const bookId = lenderBookMap[loan.library_id];
        const borrowerEntry = borrowerLibEntries
          ?.filter((e) => e.book_id === bookId)
          .sort((a, b) => {
            // Pick the entry whose created_at is closest to checkout_date
            const checkoutMs = new Date(loan.checkout_date).getTime();
            return (
              Math.abs(new Date(a.created_at).getTime() - checkoutMs) -
              Math.abs(new Date(b.created_at).getTime() - checkoutMs)
            );
          })[0];

        if (borrowerEntry) {
          const lenderUserId = lenderMap[loan.library_id];
          finalBorrowMap[borrowerEntry.id] = {
            loan_id: loan.id,
            lender_library_id: loan.library_id,
            lender_user_id: lenderUserId ?? "",
            lender_name: lenderUserId ? (nameMap[lenderUserId] ?? null) : null,
            checkout_date: loan.checkout_date,
            due_date: loan.due_date,
          };
        }
      });

      setBorrowedLoans(finalBorrowMap);
    } catch (error: any) {
      console.error("Error fetching borrowed loans:", error.message);
    }
  };

  const deleteBook = async (libraryId: string) => {
    try {
      const { error } = await supabase
        .from("library")
        .delete()
        .eq("id", libraryId);

      if (error) throw error;
      setBooks((prev) => prev.filter((b) => b.library_id !== libraryId));
      setActiveLoans((prev) => {
        const n = { ...prev };
        delete n[libraryId];
        return n;
      });
      setBorrowedLoans((prev) => {
        const n = { ...prev };
        delete n[libraryId];
        return n;
      });
    } catch (error: any) {
      Alert.alert("Error removing book", error.message);
    }
  };

  // Called from BookDetailModal after a loan is recorded so shelf updates immediately
  const onLoanRecorded = (libraryId: string, loan: ActiveLoan) => {
    setActiveLoans((prev) => ({ ...prev, [libraryId]: loan }));
  };

  const onReturnRecorded = (borrowerLibraryId: string) => {
    setBorrowedLoans((prev) => {
      const n = { ...prev };
      delete n[borrowerLibraryId];
      return n;
    });
    // Also remove the book from shelf since the borrowed copy belongs to lender
    setBooks((prev) => prev.filter((b) => b.library_id !== borrowerLibraryId));
  };

  useEffect(() => {
    const load = async () => {
      const result = await fetchLibraryBooks();
      if (!result) {
        setLoading(false);
        return;
      }
      const { user, books } = result;
      const libraryIds = books.map((b) => b.library_id);
      await Promise.all([
        fetchActiveLoans(libraryIds),
        fetchBorrowedLoans(user.id, libraryIds),
      ]);
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
                colorIndex={books.indexOf(book)}
                onDelete={deleteBook}
                onPress={(b, ci) =>
                  setSelectedBook({ book: b, colorIndex: ci })
                }
                hidden={selectedBook?.book.library_id === book.library_id}
                loaned={!!activeLoans[book.library_id]}
                borrowed={!!borrowedLoans[book.library_id]}
              />
            ))}
          </ScrollView>
        )}

        {/* Shelf plank */}
        <View style={styles.shelfPlank}>
          <View style={styles.shelfEdge} />
        </View>
      </View>

      <View style={styles.wall} />

      <View style={styles.footer}>
        <Button title="＋  Add Book" onPress={() => router.push("/modal")} />
      </View>

      <BookDetailModal
        book={selectedBook?.book ?? null}
        colorIndex={selectedBook?.colorIndex ?? 0}
        visible={selectedBook !== null}
        activeLoan={
          selectedBook
            ? (activeLoans[selectedBook.book.library_id] ?? null)
            : null
        }
        borrowedLoan={
          selectedBook
            ? (borrowedLoans[selectedBook.book.library_id] ?? null)
            : null
        }
        onClose={() => setSelectedBook(null)}
        onLoanRecorded={onLoanRecorded}
        onReturnRecorded={onReturnRecorded}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: "#1A1210" },
  wall: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1A1210",
    zIndex: -1,
  },
  header: { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 16, gap: 12 },
  headerTop: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  headerText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F0E6D3",
    letterSpacing: 1,
    fontFamily: "Georgia",
  },
  bookCount: { fontSize: 14, color: "#9A8A78", fontStyle: "italic" },
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
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    color: "#F0E6D3",
    fontSize: 14,
    fontFamily: "Georgia",
    paddingVertical: 0,
  },
  shelfWrapper: { flex: 1, justifyContent: "flex-end" },
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
  shelfEdge: { height: 4, backgroundColor: "#8B6340" },
  emptyText: {
    color: "#9A8A78",
    textAlign: "center",
    marginTop: 40,
    fontStyle: "italic",
  },
  footer: { padding: 24, paddingBottom: 40 },
});
