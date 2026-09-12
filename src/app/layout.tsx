import type { Metadata, Viewport } from "next";
import { Toaster } from "./components/ui/sonner";
import "@/styles/index.css";
export const metadata: Metadata = {
  title: {
    default: "FieldTrack · Site operations",
    template: "%s · FieldTrack",
  },
  description:
    "Construction and commissioning activities, evidence and timesheets in one place.",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "FieldTrack",
    statusBarStyle: "default",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
