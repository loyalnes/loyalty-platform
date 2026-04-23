'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // Scroll reveal animation using Intersection Observer
    const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    revealElements.forEach((el) => observer.observe(el));

    // Stats counter animation
    const statNumbers = document.querySelectorAll('.stat-number');
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
          entry.target.classList.add('counting', 'counted');

          // Animate number counting
          const target = entry.target as HTMLElement;
          const text = target.textContent || '';
          const hasPlus = text.includes('+');
          const hasPercent = text.includes('%');
          const numericValue = parseInt(text.replace(/[^0-9]/g, ''));

          if (!isNaN(numericValue)) {
            let current = 0;
            const increment = numericValue / 30;
            const timer = setInterval(() => {
              current += increment;
              if (current >= numericValue) {
                target.textContent = text;
                clearInterval(timer);
              } else {
                const suffix = hasPlus ? '+' : hasPercent ? '%' : '';
                target.textContent = Math.floor(current) + suffix;
              }
            }, 30);
          }
        }
      });
    }, observerOptions);

    statNumbers.forEach((el) => statsObserver.observe(el));

    return () => {
      observer.disconnect();
      statsObserver.disconnect();
    };
  }, []);

  return (
    <>
      {/* Hero - Split Layout */}
      <section className="hero-split">
        <div className="hero-split-image">
          <video
            className="hero-video"
            src="/hero.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label="Loyali loyalty card demo"
          />
        </div>
        <div className="hero-split-content">
          <div className="hero-badge">
            <span className="hero-badge-text">Trusted by 500+ Local Businesses</span>
          </div>
          <h1>
            Loyali. <span className="hero-shimmer">Where every visit counts.</span>
          </h1>
          <p className="hero-subtitle">
            Turn first-time customers into regulars.
            <br />
            Grow repeat visits, boost your Google ranking, and unlock word-of-mouth.
          </p>
          <div className="hero-buttons">
            <a href="/contact/" className="btn-hero btn-hero-secondary">
              Let&apos;s talk
            </a>
            <div className="hero-primary-group">
              <a href="/signup/" className="btn-hero btn-hero-primary">
                Start the magic
              </a>
              <p className="hero-trust">
                <span className="hero-trust-stat">No credit card required</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-item reveal">
            <div className="stat-number">500+</div>
            <div className="stat-label">Active Businesses</div>
          </div>
          <div className="stat-item reveal">
            <div className="stat-number">85%</div>
            <div className="stat-label">Customer Retention</div>
          </div>
          <div className="stat-item reveal">
            <div className="stat-number">30k+</div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="stat-item reveal">
            <div className="stat-number">24h</div>
            <div className="stat-label">Go Live Time</div>
          </div>
        </div>
      </section>

      {/* Why Choose Us - Storytelling */}
      <section className="benefits-section">
        <div className="section-header reveal">
          <h2>Three Ways to Grow Your Business</h2>
          <p>
            More than just loyalty points — a complete system to engage customers,
            build reputation, and drive growth.
          </p>
        </div>

        <div className="benefits-grid">
          <div className="benefit-card benefit-loyalty reveal-stagger delay-1">
            <div className="benefit-icon">💳</div>
            <h3>Stay Top of Mind</h3>
            <p className="benefit-subtitle">Digital Loyalty Program</p>
            <p>
              Your direct line to every customer&apos;s pocket. Remind, reward, and bring
              them back — automatically.
            </p>
            <ul className="benefit-list">
              <li>Push notifications to customer wallets</li>
              <li>Automated re-engagement campaigns</li>
              <li>Track visit frequency and preferences</li>
            </ul>
          </div>

          <div className="benefit-card benefit-reputation reveal-stagger delay-2">
            <div className="benefit-icon">⭐</div>
            <h3>Build Your Reputation</h3>
            <p className="benefit-subtitle">Smart Review Management</p>
            <p>
              5-star reviews go public, complaints stay private. Climb Google Maps
              without risking your reputation.
            </p>
            <ul className="benefit-list">
              <li>5-star reviews go straight to Google Maps</li>
              <li>Lower ratings captured internally</li>
              <li>Improve local SEO and discoverability</li>
            </ul>
          </div>

          <div className="benefit-card benefit-growth reveal-stagger delay-3">
            <div className="benefit-icon">🚀</div>
            <h3>Turn Customers into Advocates</h3>
            <p className="benefit-subtitle">Referral & Word-of-Mouth</p>
            <p>
              Reward customers who bring friends. Turn your regulars into your
              cheapest, most trusted marketing channel.
            </p>
            <ul className="benefit-list">
              <li>Referral rewards for both parties</li>
              <li>Track friend-brings-friend growth</li>
              <li>Organic growth through trusted networks</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="section">
        <div className="section-header reveal">
          <h2>Everything you need to grow loyalty, reputation, and referrals.</h2>
          <p>
            Built for local businesses. Zero technical skills required.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card reveal-stagger delay-1">
            <div className="feature-icon">📱</div>
            <h3>Apple &amp; Google Wallet</h3>
            <p>
              Customers add your card to their mobile wallet. No app, no login —
              just scan and earn.
            </p>
          </div>

          <div className="feature-card reveal-stagger delay-2">
            <div className="feature-icon">🔔</div>
            <h3>Push Notifications</h3>
            <p>
              Messages land directly on your customers&apos; wallets. Announce offers,
              win back inactive visitors, celebrate milestones.
            </p>
          </div>

          <div className="feature-card reveal-stagger delay-3">
            <div className="feature-icon">🎯</div>
            <h3>QR Code Check-ins</h3>
            <p>
              Scan at checkout to award points, stamps, or rewards. Zero hardware,
              zero extra devices.
            </p>
          </div>

          <div className="feature-card reveal-stagger delay-4">
            <div className="feature-icon">🎁</div>
            <h3>Flexible Rewards</h3>
            <p>
              Points, stamps, tiers — design your program your way. Change anything
              without reprinting cards.
            </p>
          </div>

          <div className="feature-card reveal-stagger delay-5">
            <div className="feature-icon">📊</div>
            <h3>Customer Analytics</h3>
            <p>
              Spot your best customers, track visit patterns, and see what keeps
              them coming back.
            </p>
          </div>

          <div className="feature-card reveal-stagger delay-6">
            <div className="feature-icon">⭐</div>
            <h3>Smart Review Management</h3>
            <p>
              Route 5-star reviews to Google, keep complaints private. Boost your
              ranking without reputation risk.
            </p>
          </div>
        </div>
      </section>


      {/* Pricing */}
      <section className="section" style={{ background: 'var(--background-surface)' }}>
        <div className="section-header reveal">
          <h2>Simple, Transparent Pricing</h2>
          <p>
            Two plans. No hidden fees. 14-day free trial, no credit card required.
          </p>
        </div>

        <div className="pricing-grid pricing-grid-two">
          <div className="pricing-card reveal-stagger delay-1">
            <h3>Core</h3>
            <div className="pricing-price">
              €9<span>/month</span>
            </div>
            <p className="pricing-tagline">Everything you need to launch loyalty.</p>
            <ul className="pricing-features">
              <li>Apple &amp; Google Wallet cards</li>
              <li>QR-based check-ins</li>
              <li>Points, stamps &amp; rewards</li>
              <li>Review management</li>
              <li>Basic analytics</li>
              <li>Email support</li>
            </ul>
            <a href="/signup/" className="pricing-cta">Start Free Trial</a>
          </div>

          <div className="pricing-card featured reveal-stagger delay-2">
            <h3>Grow</h3>
            <div className="pricing-price">
              €12<span>/month</span>
            </div>
            <p className="pricing-tagline">Unlock push campaigns and drive repeat visits.</p>
            <ul className="pricing-features">
              <li>Everything in Core</li>
              <li><strong>Push notification campaigns</strong></li>
              <li>Automated re-engagement flows</li>
              <li>Advanced analytics</li>
              <li>Referral rewards</li>
              <li>Priority support</li>
            </ul>
            <a href="/signup/" className="pricing-cta">Start Free Trial</a>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="section-header reveal">
          <h2>Loved by local businesses</h2>
        </div>

        <div className="testimonials-grid">
          <div className="testimonial reveal-stagger delay-1">
            <blockquote>
              &ldquo;We saw a 30% increase in repeat visits within the first
              month. Setup took less than 10 minutes.&rdquo;
            </blockquote>
            <div className="testimonial-author">Maria S.</div>
            <div className="testimonial-role">Owner, Caf&eacute; Bonita</div>
          </div>
          <div className="testimonial reveal-stagger delay-2">
            <blockquote>
              &ldquo;Our customers love the digital stamp card. No more lost
              paper cards — and we get real data on loyalty.&rdquo;
            </blockquote>
            <div className="testimonial-author">James T.</div>
            <div className="testimonial-role">Manager, The Craft Tap</div>
          </div>
          <div className="testimonial reveal-stagger delay-3">
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
      <section className="cta-section reveal">
        <h2>Ready to grow your repeat business?</h2>
        <p>
          Join hundreds of local businesses using Loyali. 14-day free trial.
        </p>
        <a href="/signup/" className="btn-cta">
          Start Free Trial
        </a>
        <p className="cta-trust">No credit card required</p>
      </section>
    </>
  );
}
