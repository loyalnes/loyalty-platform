export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <h1>
          Turn first-time visitors into{" "}
          <span>loyal regulars</span>
        </h1>
        <p>
          Loyali gives bars, restaurants, and shops a dead-simple loyalty
          platform — QR-based points, reputation management, and customer
          intelligence with zero hardware.
        </p>
        <div className="hero-buttons">
          <a href="/signup/" className="btn-hero btn-hero-primary">
            Start Free Trial
          </a>
          <a href="/pricing/" className="btn-hero btn-hero-secondary">
            View Pricing
          </a>
        </div>
      </section>

      {/* Three Pillars */}
      <section className="section">
        <div className="section-header">
          <h2>Three pillars to grow your business</h2>
          <p>
            Retention, reputation, and intelligence — all from one platform.
          </p>
        </div>

        <div className="pillars">
          <div className="pillar pillar-loyalty">
            <div className="pillar-icon">&#x2B50;</div>
            <h3>Loyalty &amp; Retention</h3>
            <p>
              Points, stamps, tiers, and rewards that keep customers coming
              back. QR-based — no app download needed.
            </p>
          </div>
          <div className="pillar pillar-reputation">
            <div className="pillar-icon">&#x2B50;</div>
            <h3>Reputation Management</h3>
            <p>
              Increase review volume and quality. Intercept negative feedback
              privately before it goes public.
            </p>
          </div>
          <div className="pillar pillar-intelligence">
            <div className="pillar-icon">&#x1F4CA;</div>
            <h3>Customer Intelligence</h3>
            <p>
              Know who your customers are, how often they visit, and what they
              think. Data-driven decisions, not guesswork.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section" id="features">
        <div className="section-header">
          <h2>Everything you need, nothing you don&apos;t</h2>
          <p>
            No hardware, no app downloads, no complicated setup. Just results.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">&#x1F4F1;</div>
            <h3>QR-Based Points</h3>
            <p>
              Customers scan a QR code to earn and redeem points — works on
              every phone, no app needed.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#x1F4B3;</div>
            <h3>Digital Stamp Cards</h3>
            <p>
              Replace paper punch cards with beautiful digital stamps customers
              actually use.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#x1F4CA;</div>
            <h3>Real-Time Analytics</h3>
            <p>
              See who your most loyal customers are and what rewards drive
              repeat visits.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#x26A1;</div>
            <h3>5-Minute Setup</h3>
            <p>
              Create your loyalty program in minutes. Print your QR code and
              you&apos;re live.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#x1F381;</div>
            <h3>Flexible Rewards</h3>
            <p>
              Free items, discounts, early access — configure rewards that
              match your brand.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#x1F4F2;</div>
            <h3>Wallet Passes</h3>
            <p>
              Loyalty cards in Apple Wallet and Google Wallet — always
              accessible, always top of mind.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="section-header">
          <h2>Loved by local businesses</h2>
        </div>

        <div className="testimonials-grid">
          <div className="testimonial">
            <blockquote>
              &ldquo;We saw a 30% increase in repeat visits within the first
              month. Setup took less than 10 minutes.&rdquo;
            </blockquote>
            <div className="testimonial-author">Maria S.</div>
            <div className="testimonial-role">Owner, Caf&eacute; Bonita</div>
          </div>
          <div className="testimonial">
            <blockquote>
              &ldquo;Our customers love the digital stamp card. No more lost
              paper cards — and we get real data on loyalty.&rdquo;
            </blockquote>
            <div className="testimonial-author">James T.</div>
            <div className="testimonial-role">Manager, The Craft Tap</div>
          </div>
          <div className="testimonial">
            <blockquote>
              &ldquo;The analytics alone are worth it. We finally know which
              rewards actually bring people back.&rdquo;
            </blockquote>
            <div className="testimonial-author">Priya K.</div>
            <div className="testimonial-role">Owner, Spice Route</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Ready to grow your repeat business?</h2>
        <p>
          Join hundreds of local businesses using Loyali. Free 14-day trial, no
          credit card required.
        </p>
        <a href="/signup/" className="btn-cta">
          Start Free Trial
        </a>
      </section>
    </>
  );
}
