"use client";

import { useState, type FormEvent } from "react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || undefined, city: city || undefined, country: country || undefined }),
      });

      if (res.status === 409) {
        setError("An account with this email already exists. You can sign in to your dashboard below.");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Something went wrong" }));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <section className="section">
        <div className="section-header">
          <h2>You&apos;re all set!</h2>
          <p>Your Loyali account for <strong>{name}</strong> has been created.</p>
        </div>

        <div className="signup-form" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
            Sign in to your dashboard using your email:
          </p>
          <p style={{ marginBottom: "1.5rem", fontSize: "1.125rem", fontWeight: 600 }}>
            {email}
          </p>
          <a
            href="/dashboard/"
            className="btn-hero btn-hero-primary"
            style={{ display: "block", textAlign: "center", border: "none" }}
          >
            Go to Dashboard
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>Create your account</h2>
        <p>Start your free 14-day trial. No credit card required.</p>
      </div>

      {error && (
        <div className="signup-form" style={{ marginBottom: "1rem", borderColor: "var(--color-rose-500)" }}>
          <p style={{ color: "var(--text-error)", fontSize: "var(--text-sm)", margin: 0 }}>{error}</p>
          {error.includes("already exists") && (
            <a href="/dashboard/" style={{ display: "block", marginTop: "0.5rem", fontSize: "var(--text-sm)" }}>
              Go to Dashboard Login
            </a>
          )}
        </div>
      )}

      <form className="signup-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Business name</label>
          <input id="name" type="text" required placeholder="e.g. Caf&eacute; Bonita" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required placeholder="you@yourbusiness.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone (optional)</label>
          <input id="phone" type="tel" placeholder="+39 123 456 7890" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="city">City</label>
          <input id="city" type="text" placeholder="e.g. Milan" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="country">Country</label>
          <input id="country" type="text" placeholder="e.g. Italy" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>

        <button type="submit" className="btn-hero btn-hero-primary" style={{ width: "100%", textAlign: "center", border: "none" }} disabled={loading}>
          {loading ? "Creating account..." : "Start Free Trial"}
        </button>
      </form>
    </section>
  );
}
