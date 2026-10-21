import type { Metadata, Viewport } from "next";
import { SessionProvider, AuthProvider, ApiProvider, ThemeProvider, I18nProvider, themeScript, PwaRegister, ErrorBoundary } from "@hanover/ui";
import "./globals.css";
import { RequireAuth } from "./require-auth";

export const metadata: Metadata = {
  title: "VaultA — Product Pass",
  description: "VaultA — Your sovereign ski inventory",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VaultA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#059669",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-page text-on-page antialiased transition-colors duration-200">
        <ThemeProvider>
          <I18nProvider>
          <SessionProvider>
          <AuthProvider>
            <ApiProvider>
              <ErrorBoundary>
                <RequireAuth>{children}</RequireAuth>
              </ErrorBoundary>
              <PwaRegister />
            </ApiProvider>
          </AuthProvider>
          </SessionProvider>
        </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
