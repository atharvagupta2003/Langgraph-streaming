import type { Metadata } from "next";
import "./globals.css";
import 'lenis/dist/lenis.css';
import LenisProvider from "@/components/LenisProvider";

export const metadata: Metadata = {
  title: "LangGraph Streaming Chat",
  description: "Streaming chat interface with LangGraph",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen relative">
        <LenisProvider>
          {/* Liquid glass background */}
          <div className="liquid-bg -z-10">
            <div className="liquid-blob w-[50vw] h-[50vw] rounded-full bg-purple-400/40 top-[-10%] left-[-10%]" />
            <div className="liquid-blob w-[40vw] h-[40vw] rounded-full bg-blue-400/40 bottom-[-10%] right-[-5%]" style={{ animationDelay: '4s' }} />
            <div className="liquid-blob w-[35vw] h-[35vw] rounded-full bg-pink-400/40 top-[30%] right-[35%]" style={{ animationDelay: '8s' }} />
          </div>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}