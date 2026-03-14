// utils/log.ts
import { Platform, Alert } from "react-native";

export const log = (...args: any[]) => {
  // Always print to console (Metro terminal or browser console)
  console.log(...args);

  // Optional: show a small alert on the screen (useful for testing on devices)
  
    if (Platform.OS === "web") {
  window.alert(args.map(String).join(" "));
  return;
}

  // For native (iOS/Android), show an alert for quick debug
  Alert.alert("Debug Log", args.map(String).join(" "));
};
