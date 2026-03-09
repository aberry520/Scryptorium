// app/(auth)/_layout.tsx  ← create this file
import { useEffect } from "react";
import { Stack } from "expo-router";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";

// app/(auth)/_layout.tsx
export default function AuthLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) router.replace("/(tabs)");
  }, [session, loading]);

  if (loading) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
