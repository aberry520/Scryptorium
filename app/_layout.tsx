import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Redirect, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Text } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import InstallPrompt from "./InstallPrompt";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("CAUGHT ERROR:", error.message);
    console.error("STACK:", error.stack);
    console.error("COMPONENT STACK:", info.componentStack);
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <Text>Something went wrong — check console</Text>;
    }
    return this.props.children;
  }
}

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  // Don't render redirects until auth state is known
  if (loading) return null;

  const isConfirmPage = pathname.includes("confirmsignup");

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="confirmsignup" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal", headerShown: false }}
        />
      </Stack>

      {/* Allow the confirm page through regardless of auth state */}
      {!isConfirmPage && !session && !loading && <Redirect href="/(auth)/login" />}

      {process.env.EXPO_OS === "web" && <InstallPrompt />}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ErrorBoundary>
  );
}