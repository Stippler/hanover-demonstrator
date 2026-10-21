"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  CameraOff,
  SwitchCamera,
  Flashlight,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useI18n } from "../providers/i18n-provider";

interface QrScannerProps {
  onScan: (result: string) => void;
  onClose?: () => void;
  className?: string;
  themeColor?: string;
}

type PermissionState = "prompt" | "granted" | "denied";

export function QrScanner({
  onScan,
  onClose,
  className,
  themeColor = "#3b82f6",
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);
  const scannedRef = useRef(false);

  const [permission, setPermission] = useState<PermissionState>("prompt");
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [detectorSupported, setDetectorSupported] = useState(true);
  const { t } = useI18n();

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setPermission("granted");
      setScanning(true);
      scannedRef.current = false;

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      setTorchSupported(!!capabilities?.torch);

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setHasMultipleCameras(videoDevices.length > 1);

      if (!("BarcodeDetector" in window)) {
        setDetectorSupported(false);
      }
    } catch {
      setPermission("denied");
    }
  }, [facingMode]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch {}
  }, [torchOn]);

  const switchCamera = useCallback(() => {
    setFacingMode((f) => (f === "environment" ? "user" : "environment"));
  }, []);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  // While permission is "prompt" we render no <video>, so the first startCamera() cannot
  // attach srcObject. Re-attach when the video node mounts after permission becomes "granted".
  useEffect(() => {
    if (permission !== "granted" || !scanning) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
  }, [permission, scanning]);

  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    let active = true;

    async function initDetector() {
      if ("BarcodeDetector" in window) {
        detectorRef.current = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });
      }
    }

    async function scan() {
      if (
        !active ||
        !videoRef.current ||
        !detectorRef.current ||
        scannedRef.current
      ) {
        if (active && !scannedRef.current)
          animFrameRef.current = requestAnimationFrame(scan);
        return;
      }
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          scannedRef.current = true;
          onScan(barcodes[0].rawValue);
          return;
        }
      } catch {}
      if (active) animFrameRef.current = requestAnimationFrame(scan);
    }

    initDetector().then(() => {
      if (active) animFrameRef.current = requestAnimationFrame(scan);
    });

    return () => {
      active = false;
    };
  }, [scanning, onScan]);

  if (permission === "denied") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center",
          className
        )}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-subtle">
          <CameraOff className="h-7 w-7 text-muted" />
        </div>
        <p className="font-semibold text-on-surface">{t("service.cameraAccessRequired")}</p>
        <p className="mt-2 max-w-xs text-sm text-muted">{t("service.allowCamera")}</p>
        <button
          onClick={startCamera}
          className="mt-5 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: themeColor }}
        >
          {t("service.tryAgain")}
        </button>
      </div>
    );
  }

  if (permission === "prompt") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center",
          className
        )}
      >
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted" />
        <p className="text-sm text-faint">{t("service.requestingCamera")}</p>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-black", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-56 w-56 sm:h-64 sm:w-64">
          <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-[3px] border-t-[3px] border-white" />
          <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-[3px] border-t-[3px] border-white" />
          <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-white" />
          <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-[3px] border-r-[3px] border-white" />

          <div className="animate-scan absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-black/50 [mask-image:radial-gradient(ellipse_200px_200px_at_center,transparent_60%,black_100%)]" />

      {!detectorSupported && (
        <div className="absolute left-4 right-4 top-4 rounded-xl bg-amber-500/90 px-4 py-2.5 text-center text-xs font-semibold text-black backdrop-blur-sm">
          {t("service.qrNotSupported")}
        </div>
      )}

      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3">
        {torchSupported && (
          <button
            onClick={toggleTorch}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition-colors",
              torchOn
                ? "bg-yellow-500/90 text-black"
                : "bg-white/20 text-white hover:bg-white/30"
            )}
          >
            <Flashlight className="h-5 w-5" />
          </button>
        )}
        {hasMultipleCameras && (
          <button
            onClick={switchCamera}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/30"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        )}
        {onClose && (
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-xs font-medium text-white/70 drop-shadow-sm">
          {t("service.pointCameraAtQr")}
        </p>
      </div>
    </div>
  );
}
