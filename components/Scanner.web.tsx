import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import React, { useEffect, useRef } from "react";

import { log } from "../utils/log";

type ScannerProps = {
  onScan: (result: { data: string }) => void;
};

const REGION_ID = "qr5-scanner";

export default function Scanner({ onScan }: ScannerProps) {
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (__DEV__) {
      const timer = setTimeout(() => {
        onScanRef.current({ data: "9780593311776" });
      }, 2000);
      return () => clearTimeout(timer);
    }
    html5QrcodeRef.current = new Html5Qrcode(REGION_ID);

    html5QrcodeRef.current
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 140 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        },
        (decodedText) => {
          onScanRef.current({ data: decodedText });
          html5QrcodeRef.current?.stop();
        },
        () => {},
      )
      .catch((err) => log("QR5 Start Error:", err));

    return () => {
      html5QrcodeRef.current?.stop().catch(() => {});
      html5QrcodeRef.current = null; // ← clear so next mount starts fresh
    };
  }, []);

  return (
    <div
      id={REGION_ID}
      style={{
        width: "100%",

        height: "100%",

        backgroundColor: "#000",
      }}
    />
  );
}
