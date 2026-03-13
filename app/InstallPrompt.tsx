import { useEffect, useState } from "react";
import { Platform, View, Text, Pressable, StyleSheet } from "react-native";

let deferredPrompt: any = null;

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsIOS(ios);
    setInstalled(standalone);

    if (!standalone) {
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setVisible(true);
    });
  }, []);

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      setVisible(false);
    }
  };

  if (!visible || installed) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Install Scryptorium</Text>

      {isIOS ? (
        <Text style={styles.text}>
          Tap the Share button and select{" "}
          <Text style={{ fontWeight: "bold" }}>Add to Home Screen</Text>
        </Text>
      ) : (
        <Text style={styles.text}>
          Install the app for the best reading experience.
        </Text>
      )}

      {!isIOS && (
        <Pressable style={styles.button} onPress={install}>
          <Text style={styles.buttonText}>Install</Text>
        </Pressable>
      )}

      <Pressable onPress={() => setVisible(false)}>
        <Text style={styles.dismiss}>Maybe later</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "fixed",
    bottom: 20,
    left: 20,
    right: 20,
    padding: 20,
    backgroundColor: "#fff7e6",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  text: {
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#c28f2c",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  dismiss: {
    marginTop: 10,
    textAlign: "center",
    color: "#555",
  },
});
