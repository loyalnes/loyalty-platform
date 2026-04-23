import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Loyali - Digital Loyalty Cards for Apple & Google Wallet",
    template: "%s | Loyali",
  },
  description:
    "Build customer loyalty with digital wallet cards. QR-based points, stamps, and analytics for local businesses. 85% retention rate. Live in 24 hours.",
  keywords: [
    "digital loyalty cards",
    "loyalty cards",
    "customer retention",
    "customer loyalty program",
    "Apple Wallet loyalty",
    "Google Wallet loyalty",
    "digital wallet",
    "QR code loyalty program",
    "customer engagement",
    "loyalty platform",
    "small business software",
    "repeat customers",
    "customer analytics",
    "stamp card app",
    "restaurant loyalty",
    "cafe loyalty program",
  ],
  authors: [{ name: "Loyali", url: "https://loyali.online" }],
  creator: "Loyali",
  publisher: "Loyali",
  applicationName: "Loyali",
  referrer: "origin-when-cross-origin",
  category: "Business Software",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['it_IT', 'es_ES'],
    url: 'https://loyali.online',
    siteName: 'Loyali',
    title: 'Loyali - Digital Loyalty Cards for Apple & Google Wallet',
    description:
      'Build customer loyalty with digital wallet cards. QR-based points, stamps, and analytics. 85% retention rate. Live in 24 hours.',
    images: [
      {
        url: 'https://loyali.online/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Loyali - Digital Loyalty Platform for Apple Wallet and Google Wallet',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@loyali',
    creator: '@loyali',
    title: 'Loyali - Digital Loyalty Cards for Apple & Google Wallet',
    description:
      'Build customer loyalty with digital wallet cards. QR-based points, stamps, and analytics. 85% retention rate.',
    images: [
      {
        url: 'https://loyali.online/og-image.png',
        alt: 'Loyali - Digital Loyalty Platform',
      },
    ],
  },
  alternates: {
    canonical: 'https://loyali.online',
    languages: {
      'en-US': 'https://loyali.online',
      'it-IT': 'https://loyali.online/it',
      'es-ES': 'https://loyali.online/es',
    },
  },
  metadataBase: new URL('https://loyali.online'),
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  verification: {
    // Populate once set up in Google Search Console / Bing Webmaster:
    // google: 'your-google-site-verification-token',
    // other: { 'msvalidate.01': 'your-bing-verification-token' },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#7750e7' },
    { media: '(prefers-color-scheme: dark)', color: '#4F46E5' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Schema markup for SEO
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Loyali",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": "29",
      "highPrice": "149",
      "offerCount": "3"
    },
    "description": "Digital loyalty card platform for Apple Wallet and Google Wallet. QR-based loyalty programs, customer retention tools, and analytics for local businesses.",
    "url": "https://loyali.online",
    "provider": {
      "@type": "Organization",
      "name": "Loyali",
      "url": "https://loyali.online",
      "logo": "https://loyali.online/favicon.svg"
    },
    "featureList": [
      "Digital loyalty cards for Apple Wallet and Google Wallet",
      "QR code check-ins with no app required",
      "Push notifications to customer wallets",
      "Customer analytics and retention tracking",
      "Review management and feedback collection",
      "Flexible rewards programs (points, stamps, tiers)"
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "500",
      "bestRating": "5",
      "worstRating": "1"
    }
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Loyali",
    "description": "SaaS platform for physical stores - loyalty programs, review management, and customer intelligence.",
    "url": "https://loyali.online",
    "logo": "https://loyali.online/favicon.svg",
    "priceRange": "$29-$149",
    "areaServed": {
      "@type": "Place",
      "name": "Global"
    }
  };

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Loyali Digital Loyalty Platform",
    "description": "Turn every in-store visit into repeat business with QR-based loyalty cards, review management, and customer insights. Zero hardware, 5-minute setup.",
    "brand": {
      "@type": "Brand",
      "name": "Loyali"
    },
    "offers": [
      {
        "@type": "Offer",
        "name": "Starter",
        "price": "29",
        "priceCurrency": "USD",
        "description": "Up to 100 active customers, 1 loyalty card template, QR-based check-ins, basic analytics"
      },
      {
        "@type": "Offer",
        "name": "Core",
        "price": "79",
        "priceCurrency": "USD",
        "description": "Up to 500 active customers, unlimited card templates, push notifications, advanced analytics, review management"
      },
      {
        "@type": "Offer",
        "name": "Grow",
        "price": "149",
        "priceCurrency": "USD",
        "description": "Up to 2,000 active customers, referral rewards, custom branding, API access, dedicated account manager"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "500"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is Loyali?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Loyali is a digital loyalty card platform that allows local businesses to create loyalty programs using Apple Wallet and Google Wallet. No app download required for customers - they simply scan a QR code to join and earn rewards."
        }
      },
      {
        "@type": "Question",
        "name": "How long does it take to set up Loyali?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Loyali can be set up in under 5 minutes. Create your card, print your QR code, and start enrolling customers immediately. No hardware installation or technical training required."
        }
      },
      {
        "@type": "Question",
        "name": "Do customers need to download an app?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Customers add your loyalty card directly to their Apple Wallet or Google Wallet by scanning a QR code. No app download, no login friction - just scan and earn."
        }
      },
      {
        "@type": "Question",
        "name": "What types of businesses use Loyali?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Loyali is designed for physical stores including cafes, restaurants, bars, retail shops, salons, and other local businesses that want to increase customer retention and repeat visits."
        }
      },
      {
        "@type": "Question",
        "name": "How much does Loyali cost?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Loyali offers three plans: Starter ($29/month for up to 100 customers), Core ($79/month for up to 500 customers), and Grow ($149/month for up to 2,000 customers). All plans include a 14-day free trial and no credit card required to start."
        }
      }
    ]
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body>
        <nav className="nav">
          <a href="/" className="nav-brand">Loyali</a>
          <div className="nav-center">
            <a href="/#features">Features</a>
            <a href="/pricing/">Pricing</a>
          </div>
          <div className="nav-actions">
            <a href="/dashboard/" className="nav-link-secondary">Log in</a>
            <a href="/signup/" className="nav-cta">Get a Demo</a>
          </div>
        </nav>

        <main>
          {children}
        </main>

        <footer className="footer">
          <div className="footer-content">
            <div className="footer-brand">
              <p className="footer-logo">Loyali</p>
              <p className="footer-tagline">Every visit counts.</p>
            </div>
            <div className="footer-links">
              <div className="footer-section">
                <div className="footer-section-title">Product</div>
                <a href="/#features">Features</a>
                <a href="/pricing/">Pricing</a>
              </div>
              <div className="footer-section">
                <div className="footer-section-title">Company</div>
                <a href="/about/">About</a>
                <a href="/contact/">Contact</a>
              </div>
              <div className="footer-section">
                <div className="footer-section-title">Legal</div>
                <a href="/privacy/">Privacy</a>
                <a href="/terms/">Terms</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Loyali. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
