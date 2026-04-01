export default function PricingPage() {
  return (
    <section className="section">
      <div className="section-header">
        <h2>Simple, transparent pricing</h2>
        <p>Start free. Upgrade when you grow.</p>
      </div>

      <div className="pricing-grid">
        <div className="pricing-card">
          <h3>Free</h3>
          <div className="pricing-price">
            &euro;0<span>/mo</span>
          </div>
          <ul className="pricing-features">
            <li>1 location</li>
            <li>Up to 50 loyalty cards</li>
            <li>QR-based points</li>
            <li>Basic analytics</li>
          </ul>
          <a href="/signup/" className="btn-hero btn-hero-primary" style={{ display: "block", textAlign: "center" }}>
            Get Started
          </a>
        </div>

        <div className="pricing-card featured">
          <h3>Starter</h3>
          <div className="pricing-price">
            &euro;29<span>/mo</span>
          </div>
          <ul className="pricing-features">
            <li>Up to 3 locations</li>
            <li>Unlimited loyalty cards</li>
            <li>Digital stamp cards</li>
            <li>Review management</li>
            <li>Customer analytics</li>
            <li>Wallet passes</li>
          </ul>
          <a href="/signup/" className="btn-hero btn-hero-primary" style={{ display: "block", textAlign: "center" }}>
            Start Free Trial
          </a>
        </div>

        <div className="pricing-card">
          <h3>Professional</h3>
          <div className="pricing-price">
            &euro;79<span>/mo</span>
          </div>
          <ul className="pricing-features">
            <li>Unlimited locations</li>
            <li>Everything in Starter</li>
            <li>Advanced segmentation</li>
            <li>Custom rewards</li>
            <li>Priority support</li>
            <li>API access</li>
          </ul>
          <a href="/signup/" className="btn-hero btn-hero-secondary" style={{ display: "block", textAlign: "center" }}>
            Contact Sales
          </a>
        </div>
      </div>
    </section>
  );
}
