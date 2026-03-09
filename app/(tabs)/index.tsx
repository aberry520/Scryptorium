import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  FlatList,
  RefreshControl,
  StyleSheet,
} from "react-native";

type LibraryBook = {
  library_id: number;
  user_id: string;
  username: string; // from profiles
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
        .from("user_library_books") // ← use the view now
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
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>
        My Library
      </ThemedText>

      <Button title="Add Book" onPress={() => router.push("/modal")} />

      {loading ? (
        <ThemedText>Loading...</ThemedText>
      ) : books.length === 0 ? (
        <ThemedText>No books found. Add some!</ThemedText>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.book_id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }: { item: LibraryBook }) => (
            <ThemedView style={styles.bookItem}>
              <ThemedText type="subtitle">{item.title}</ThemedText>
              <ThemedText type="default">{item.author}</ThemedText>
            </ThemedView>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  header: {
    marginBottom: 16,
    paddingTop: 60,
  },
  bookItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
    marginBottom: 8,
  },
});
