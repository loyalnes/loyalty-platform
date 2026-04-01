export default function SignupPage() {
  return (
    <section className="section">
      <div className="section-header">
        <h2>Create your account</h2>
        <p>Start your free 14-day trial. No credit card required.</p>
      </div>

      <form className="signup-form" action="/api/merchants" method="POST">
        <div className="form-group">
          <label htmlFor="name">Business name</label>
          <input id="name" name="name" type="text" required placeholder="e.g. Caf&eacute; Bonita" />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required placeholder="you@yourbusiness.com" />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone (optional)</label>
          <input id="phone" name="phone" type="tel" placeholder="+39 123 456 7890" />
        </div>

        <div className="form-group">
          <label htmlFor="city">City</label>
          <input id="city" name="city" type="text" placeholder="e.g. Milan" />
        </div>

        <div className="form-group">
          <label htmlFor="country">Country</label>
          <input id="country" name="country" type="text" placeholder="e.g. Italy" />
        </div>

        <button type="submit" className="btn-hero btn-hero-primary" style={{ width: "100%", textAlign: "center", border: "none" }}>
          Start Free Trial
        </button>
      </form>
    </section>
  );
}
