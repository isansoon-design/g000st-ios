import { ConfirmModalProvider } from "@/context/ConfirmModalContext";
import { CallingBootstrap } from "@/features/calling/calling-bootstrap";
import { CallOverlayHost } from "@/features/calling/call-overlay";
import { SessionSync } from "@/features/auth/session-sync";
import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
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
      <body>
        <ConfirmModalProvider>
          <SessionSync />
          {children}
          <CallingBootstrap />
          <CallOverlayHost />
          <Toaster position="bottom-center" />
        </ConfirmModalProvider>
      </body>
    </html>
  );
}
