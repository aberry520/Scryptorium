import { CameraView } from "expo-camera";
import React from "react";
import { StyleSheet, View } from "react-native";

type ScannerProps = {
  onScan: (data: string) => void;
};

export default function Scanner({ onScan }: ScannerProps) {
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={onScan}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
});
