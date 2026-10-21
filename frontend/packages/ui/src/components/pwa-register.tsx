"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      const dismissed = sessionStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setInstallPrompt(null);
  }, [installPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  }, []);

  if (!showBanner) return null;

  return (
    <div className="safe-area-pb fixed bottom-20 left-4 right-4 z-[60] animate-slide-up rounded-2xl border border-line/50 bg-surface/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:left-auto sm:right-4 sm:w-80">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
          <Download className="h-5 w-5 text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-on-page">Install App</p>
          <p className="mt-0.5 text-xs text-faint">
            Add to your home screen for a better experience.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-faint transition-colors hover:text-on-page"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-on-page"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
