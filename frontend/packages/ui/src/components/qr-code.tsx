"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export interface QrCodeImageHandle {
  getCanvas: () => HTMLCanvasElement | null;
  downloadPng: (filename?: string) => void;
}

export const QrCodeImage = forwardRef<QrCodeImageHandle, QrCodeProps>(function QrCodeImage(
  { value, size = 200, className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    downloadPng: (filename = "qrcode.png") => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    },
  }));

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
    />
  );
});
