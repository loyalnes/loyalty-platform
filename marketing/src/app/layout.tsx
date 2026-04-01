import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loyali — Loyalty, Reputation & Customer Intelligence for Local Businesses",
  description:
    "Turn every in-store visit into repeat business. QR-based loyalty, review management, and customer insights — zero hardware, 5-minute setup.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <a href="/" className="nav-brand">Loyali</a>
          <ul className="nav-links">
            <li><a href="/#features">Features</a></li>
            <li><a href="/pricing/">Pricing</a></li>
            <li><a href="/signup/" className="nav-cta">Get Started</a></li>
          </ul>
        </nav>

        {children}

        <footer className="footer">
          <p>&copy; {new Date().getFullYear()} Loyali. Every visit counts.</p>
        </footer>
      </body>
    </html>
  );
}
