import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />

        {/* Enable PWA mode on iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />

        {/* Status bar style */}
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        {/* Theme color for Android + some iOS behavior */}
        <meta name="theme-color" content="#945e3a" />

        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Important for notch + translucent status bar */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        <link rel="manifest" href="../manifest.json" />

        <ScrollViewStyleReset />
      </head>

      <body style={{ backgroundColor: "#000000" }}>{children}</body>
    </html>
  );
}
