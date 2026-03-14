import { Html5Qrcode, Html5QrcodeScanner } from "html5-qrcode";
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
    function onScanSuccess(decodedText, decodedResult) {
      // handle the scanned code as you like, for example:
      //   log(`Code matched = ${decodedText}`, decodedResult);s
      onScan({ data: decodedText });
    }
    function onScanFailure(error) {
      // handle scan failure, usually better to ignore and keep scanning.
      // for example:
      //   log(`Code scan error = ${error}`);
    }

    let html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false,
    );
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
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
        paddingTop: "25%",
        backgroundColor: "#bea876dd",
      }}
    >
      <div id="reader" style={{ marginTop: "100" }}></div>
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
