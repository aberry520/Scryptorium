import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import React, { useEffect, useRef, useState } from "react";
import { log } from "../utils/log";

type ScannerProps = {
  onScan: (result: { data: string }) => void;
};

export default function Scanner({ onScan }: ScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    if (!scannerRef.current) return;

    const regionId = "qr5-scanner";
    scannerRef.current.id = regionId;

    html5QrcodeRef.current = new Html5Qrcode(regionId);

    html5QrcodeRef.current
      .start(
        { facingMode: "environment" },
        {
          fps: 30,
          //   qrbox: { width: 280, height: 140 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        },
        (decodedText) => {
          log("QR Code Scanned:", decodedText);
          onScan({ data: decodedText });
          html5QrcodeRef.current?.stop();
        },
        () => {},
      )
      .catch((err) => log("QR5 Start Error:", err));

    return () => {
      html5QrcodeRef.current?.stop().catch(() => {});
    };
  }, []);

  const toggleFlash = async () => {
    const capabilities =
      html5QrcodeRef.current?.getRunningTrackCameraCapabilities();
    const torchFeature = capabilities?.torchFeature();
    if (!torchFeature?.isSupported()) {
      log("Torch not supported on this device");
      return;
    }
    const current = torchFeature.value();
    await torchFeature.apply(!current);
    setFlashOn(!current);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#000",
      }}
    >
      <div
        ref={scannerRef}
        style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
      />
      <button
        onClick={toggleFlash}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 999,
          background: flashOn
            ? "rgba(255,255,200,0.3)"
            : "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: 8,
          padding: "8px 14px",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
        }}
      >
        {flashOn ? "🔦" : "🔦"}
      </button>
    </div>
  );
}
