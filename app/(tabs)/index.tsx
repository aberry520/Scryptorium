import { BookDetailModal } from "@/components/BookDetailModal";
import { BookSpine } from "@/components/BookSpine";
import { supabase } from "@/lib/supabase";
import { ActiveLoan, BorrowedLoan, LibraryBook } from "@/types";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Button,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type FilterMode = "all" | "checkedOut" | "borrowing";
type SortOrder = "newest" | "oldest";

export default function HomeScreen() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [activeLoans, setActiveLoans] = useState<Record<string, ActiveLoan>>({});
  const [borrowedLoans, setBorrowedLoans] = useState<Record<string, BorrowedLoan>>({});
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<{
    book: LibraryBook;
    colorIndex: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setDrawerOpen(false));
  };

  const filteredBooks = useMemo(() => {
    let result = [...books];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q),
      );
    }

    if (filterMode === "checkedOut") {
      result = result.filter((b) => !!activeLoans[b.library_id]);
    } else if (filterMode === "borrowing") {
      result = result.filter((b) => !!borrowedLoans[b.library_id]);
    }

    result.sort((a, b) => {
      let aTime: number;
      let bTime: number;

      if (filterMode === "checkedOut") {
        aTime = new Date(activeLoans[a.library_id]?.checkout_date ?? 0).getTime();
        bTime = new Date(activeLoans[b.library_id]?.checkout_date ?? 0).getTime();
      } else if (filterMode === "borrowing") {
        aTime = new Date(borrowedLoans[a.library_id]?.checkout_date ?? 0).getTime();
        bTime = new Date(borrowedLoans[b.library_id]?.checkout_date ?? 0).getTime();
      } else {
        aTime = new Date(a.library_created_at).getTime();
        bTime = new Date(b.library_created_at).getTime();
      }

      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return result;
  }, [books, searchQuery, filterMode, sortOrder, activeLoans, borrowedLoans]);

  const fetchLibraryBooks = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not logged in");

      const { data, error } = await supabase
        .from("user_library_books_v2")
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

  const fetchActiveLoans = async (libraryIds: string[]) => {
    if (libraryIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("loans")
        .select("id, library_id, borrower_user_id, checkout_date, due_date")
        .in("library_id", libraryIds)
        .is("return_date", null);

      if (error) throw error;
      if (!data || data.length === 0) return;

      const borrowerIds = [...new Set(data.map((l) => l.borrower_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", borrowerIds);

      const nameMap: Record<string, string | null> = {};
      profiles?.forEach((p) => { nameMap[p.id] = p.name; });

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

  const fetchBorrowedLoans = async (userId: string, libraryIds: string[]) => {
    if (libraryIds.length === 0) return;
    try {
      const { data: borrowedData, error: borrowedError } = await supabase
        .from("loans")
        .select("id, library_id, borrower_user_id, checkout_date, due_date")
        .eq("borrower_user_id", userId)
        .is("return_date", null);

      if (borrowedError) throw borrowedError;
      if (!borrowedData || borrowedData.length === 0) return;

      const lenderLibraryIds = borrowedData.map((l) => l.library_id);
      const { data: lenderEntries } = await supabase
        .from("library")
        .select("id, user_id")
        .in("id", lenderLibraryIds);

      const lenderUserIds = [...new Set(lenderEntries?.map((e) => e.user_id) ?? [])];
      const { data: lenderProfiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", lenderUserIds);

      const nameMap: Record<string, string | null> = {};
      lenderProfiles?.forEach((p) => { nameMap[p.id] = p.name; });

      const lenderMap: Record<string, string> = {};
      lenderEntries?.forEach((e) => { lenderMap[e.id] = e.user_id; });

      const { data: lenderLibDetails } = await supabase
        .from("library")
        .select("id, book_id, user_id")
        .in("id", lenderLibraryIds);

      const lenderBookMap: Record<string, string> = {};
      lenderLibDetails?.forEach((e) => { lenderBookMap[e.id] = e.book_id; });

      const relevantBookIds = Object.values(lenderBookMap);
      if (relevantBookIds.length === 0) return;

      const { data: borrowerLibEntries } = await supabase
        .from("library")
        .select("id, book_id, created_at")
        .eq("user_id", userId)
        .in("book_id", relevantBookIds);

      const finalBorrowMap: Record<string, BorrowedLoan> = {};
      borrowedData.forEach((loan) => {
        const bookId = lenderBookMap[loan.library_id];
        const borrowerEntry = borrowerLibEntries
          ?.filter((e) => e.book_id === bookId)
          .sort((a, b) => {
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
      const { error } = await supabase.from("library").delete().eq("id", libraryId);
      if (error) throw error;
      setBooks((prev) => prev.filter((b) => b.library_id !== libraryId));
      setActiveLoans((prev) => { const n = { ...prev }; delete n[libraryId]; return n; });
      setBorrowedLoans((prev) => { const n = { ...prev }; delete n[libraryId]; return n; });
    } catch (error: any) {
      Alert.alert("Error removing book", error.message);
    }
  };

  const onLoanRecorded = (libraryId: string, loan: ActiveLoan) => {
    setActiveLoans((prev) => ({ ...prev, [libraryId]: loan }));
  };

  const onReturnRecorded = (borrowerLibraryId: string) => {
    setBorrowedLoans((prev) => { const n = { ...prev }; delete n[borrowerLibraryId]; return n; });
    setBooks((prev) => prev.filter((b) => b.library_id !== borrowerLibraryId));
  };

  useEffect(() => {
    const load = async () => {
      const result = await fetchLibraryBooks();
      if (!result) { setLoading(false); return; }
      const { user, books } = result;
      const libraryIds = books.map((b) => b.library_id);
      await Promise.all([fetchActiveLoans(libraryIds), fetchBorrowedLoans(user.id, libraryIds)]);
      setLoading(false);
    };
    load();
  }, []);

  const checkedOutCount = books.filter((b) => !!activeLoans[b.library_id]).length;
  const borrowingCount = books.filter((b) => !!borrowedLoans[b.library_id]).length;
  const isSearching = searchQuery.trim().length > 0;
  const isFiltered = filterMode !== "all";
  const hasActiveFilters = isFiltered || sortOrder !== "newest";

  const emptyMessage = () => {
    if (isSearching && isFiltered) return `No ${filterMode === "checkedOut" ? "checked out" : "borrowed"} books matching "${searchQuery}"`;
    if (isSearching) return `No books matching "${searchQuery}"`;
    if (filterMode === "checkedOut") return "No books currently checked out";
    if (filterMode === "borrowing") return "No books currently borrowed";
    return "No books yet. Add some!";
  };

  return (
    <View style={styles.room}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerText}>My Library</Text>
          <Text style={styles.bookCount}>
            {isSearching || isFiltered
              ? `${filteredBooks.length} of ${books.length}`
              : `${books.length} books`}
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search Library"
              placeholderTextColor="#6A5A4A"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Filter trigger button */}
          <TouchableOpacity
            style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
            onPress={openDrawer}
          >
            <Text style={styles.filterButtonIcon}>⚙︎</Text>
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Bookshelf area */}
      <View style={styles.shelfWrapper}>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : filteredBooks.length === 0 ? (
          <Text style={styles.emptyText}>{emptyMessage()}</Text>
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
                onPress={(b, ci) => setSelectedBook({ book: b, colorIndex: ci })}
                hidden={selectedBook?.book.library_id === book.library_id}
                loaned={!!activeLoans[book.library_id]}
                borrowed={!!borrowedLoans[book.library_id]}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.shelfPlank}>
          <View style={styles.shelfEdge} />
        </View>
      </View>

      <View style={styles.wall} />

      <View style={styles.footer}>
        <Button title="＋  Add Book" onPress={() => router.push("/modal")} />
      </View>

      {/* Filter / Sort Drawer */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="none"
        onRequestClose={closeDrawer}
      >
        <Pressable style={styles.drawerBackdrop} onPress={closeDrawer}>
          <Animated.View
            style={[styles.drawer, { transform: [{ translateY: slideAnim }] }]}
          >
            <Pressable>
              {/* Handle */}
              <View style={styles.drawerHandle} />

              <Text style={styles.drawerTitle}>Filter & Sort</Text>

              {/* Filter section */}
              <Text style={styles.drawerLabel}>Show</Text>
              <View style={styles.drawerPills}>
                {(["all", "checkedOut", "borrowing"] as FilterMode[]).map((mode) => {
                  const labels: Record<FilterMode, string> = {
                    all: "All Books",
                    checkedOut: `📤 Checked Out${checkedOutCount > 0 ? ` (${checkedOutCount})` : ""}`,
                    borrowing: `📥 Borrowing${borrowingCount > 0 ? ` (${borrowingCount})` : ""}`,
                  };
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.drawerPill, filterMode === mode && styles.drawerPillActive]}
                      onPress={() => setFilterMode(mode)}
                    >
                      <Text style={[styles.drawerPillText, filterMode === mode && styles.drawerPillTextActive]}>
                        {labels[mode]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sort section */}
              <Text style={styles.drawerLabel}>Sort by date</Text>
              <View style={styles.drawerPills}>
                {(["newest", "oldest"] as SortOrder[]).map((order) => (
                  <TouchableOpacity
                    key={order}
                    style={[styles.drawerPill, sortOrder === order && styles.drawerPillActive]}
                    onPress={() => setSortOrder(order)}
                  >
                    <Text style={[styles.drawerPillText, sortOrder === order && styles.drawerPillTextActive]}>
                      {order === "newest" ? "↓ Newest first" : "↑ Oldest first"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reset */}
              {hasActiveFilters && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => { setFilterMode("all"); setSortOrder("newest"); }}
                >
                  <Text style={styles.resetText}>Reset to defaults</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.doneButton} onPress={closeDrawer}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <BookDetailModal
        book={selectedBook?.book ?? null}
        colorIndex={selectedBook?.colorIndex ?? 0}
        visible={selectedBook !== null}
        activeLoan={selectedBook ? (activeLoans[selectedBook.book.library_id] ?? null) : null}
        borrowedLoan={selectedBook ? (borrowedLoans[selectedBook.book.library_id] ?? null) : null}
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
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#1A1210", zIndex: -1,
  },
  header: { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 16, gap: 12 },
  headerTop: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  headerText: {
    fontSize: 28, fontWeight: "700", color: "#F0E6D3",
    letterSpacing: 1, fontFamily: "Georgia",
  },
  bookCount: { fontSize: 14, color: "#9A8A78", fontStyle: "italic" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#2A1E16", borderRadius: 10,
    borderWidth: 1, borderColor: "#3D2B1A",
    paddingHorizontal: 12, height: 40, gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1, color: "#F0E6D3", fontSize: 14,
    fontFamily: "Georgia", paddingVertical: 0,
  },
  filterButton: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#2A1E16", borderWidth: 1,
    borderColor: "#3D2B1A", alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: { borderColor: "#A0723A", backgroundColor: "#3A2510" },
  filterButtonIcon: { fontSize: 18, color: "#9A8A78" },
  filterDot: {
    position: "absolute", top: 7, right: 7,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: "#C8A96E",
  },
  shelfWrapper: { flex: 1, justifyContent: "flex-end" },
  spineRow: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 16, paddingBottom: 0, gap: 3,
  },
  shelfPlank: {
    height: 18, backgroundColor: "#5C3D1E",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6, shadowRadius: 6, elevation: 8,
    borderTopWidth: 2, borderTopColor: "#7A5230",
  },
  shelfEdge: { height: 4, backgroundColor: "#8B6340" },
  emptyText: {
    color: "#9A8A78", textAlign: "center",
    marginTop: 40, fontStyle: "italic",
  },
  footer: { padding: 24, paddingBottom: 40 },
  // Drawer
  drawerBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  drawer: {
    backgroundColor: "#22160E", borderTopLeftRadius: 20,
    borderTopRightRadius: 20, paddingHorizontal: 24,
    paddingBottom: 40, paddingTop: 12,
    borderTopWidth: 1, borderColor: "#3D2B1A",
  },
  drawerHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#5C3D1E", alignSelf: "center", marginBottom: 20,
  },
  drawerTitle: {
    fontSize: 18, fontWeight: "700", color: "#F0E6D3",
    fontFamily: "Georgia", marginBottom: 20,
  },
  drawerLabel: {
    fontSize: 12, color: "#9A8A78", fontFamily: "Georgia",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 10,
  },
  drawerPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  drawerPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: "#3D2B1A", backgroundColor: "#2A1E16",
  },
  drawerPillActive: { backgroundColor: "#7A5230", borderColor: "#A0723A" },
  drawerPillText: { fontSize: 14, color: "#9A8A78", fontFamily: "Georgia" },
  drawerPillTextActive: { color: "#F0E6D3", fontWeight: "600" },
  resetButton: { alignItems: "center", marginBottom: 12 },
  resetText: { fontSize: 13, color: "#9A8A78", fontFamily: "Georgia", textDecorationLine: "underline" },
  doneButton: {
    backgroundColor: "#7A5230", borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  doneText: { fontSize: 16, color: "#F0E6D3", fontWeight: "600", fontFamily: "Georgia" },
});
