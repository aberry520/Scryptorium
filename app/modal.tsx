import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, Button, StyleSheet } from "react-native";

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

export default function ModalScreen() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(false);

  const addBook = async () => {
    if (!title || !author) {
      Alert.alert("Error", "Please enter both title and author.");
      return;
    }

    setLoading(true);

    try {
      // 1. Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error("No user logged in");

      // 2. Insert book and get the inserted id
      const { data: book, error: booksError } = await supabase
        .from("books")
        .insert({ title, author })
        .select()
        .single();
      if (booksError) throw booksError;

      // 3. Insert into library using book.id and user.id
      const { error: libraryError } = await supabase.from("library").insert({
        book_id: book.id,
        user_id: user.id,
      });
      if (libraryError) throw libraryError;

      // 4. Reset form & notify
      setTitle("");
      setAuthor("");
      Alert.alert("Success", "Book added to your library!");

      // 5. Go back to home screen
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Add a Book</ThemedText>

      <ThemedTextInput
        placeholder="Book Title"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />

      <ThemedTextInput
        placeholder="Author"
        value={author}
        onChangeText={setAuthor}
        style={styles.input}
      />

      <Button title={loading ? "Adding..." : "Add Book"} onPress={addBook} />

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
    justifyContent: "center",
    padding: 20,
  },
  input: {
    width: "100%",
    marginVertical: 10,
  },
  link: {
    marginTop: 20,
    paddingVertical: 10,
  },
});
