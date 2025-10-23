import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import { MaintenanceProvider } from "@/contexts/MaintenanceContext";
import Navbar from "@/components/layout/Navbar";
import MaintenanceAccessModal from "@/components/MaintenanceAccessModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Label App - Dataset Labeling Tool",
  description: "A tool for labeling app reviews and analyzing sentiment",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 min-h-screen`}>
        <MaintenanceProvider>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {children}
              </main>
              <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-6">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    &copy; {new Date().getFullYear()} Label App By MoN.
                  </p>
                </div>
              </footer>
            </div>
            <Toaster position="top-right" />
            <MaintenanceAccessModal />
          </AuthProvider>
        </MaintenanceProvider>
      </body>
    </html>
  );
}