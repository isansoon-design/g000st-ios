import { ConfirmModalProvider } from "@/context/ConfirmModalContext";
import { CallingBootstrap } from "@/features/calling/calling-bootstrap";
import { CallOverlayHost } from "@/features/calling/call-overlay";
import { SessionSync } from "@/features/auth/session-sync";
import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { PublicThemeControl, ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "g000st - Social Chat",
  description: "Private social chat application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var m=localStorage.getItem('g000st:app-theme:v1')==='dark'?'dark':'light';document.documentElement.dataset.theme=m;document.documentElement.classList.toggle('dark',m==='dark')}catch(e){document.documentElement.dataset.theme='light'}` }} />
      </head>
      <body>
        <ThemeProvider>
        <PublicThemeControl />
        <ConfirmModalProvider>
          <SessionSync />
          {children}
          <CallingBootstrap />
          <CallOverlayHost />
          <Toaster position="bottom-center" toastOptions={{ style: { background: "var(--app-surface)", color: "var(--app-text)" } }} />
        </ConfirmModalProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
