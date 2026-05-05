interface WalletLinkEmail {
  to: string;
  merchantName: string;
  customerFirstName: string;
  loyaltyUrl: string;
}

export async function sendWalletLinkEmail({ to, merchantName, customerFirstName, loyaltyUrl }: WalletLinkEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Loyali <noreply@loyali.online>";

  const subject = `${merchantName}: la tua tessera fedeltà`;
  const html = `
    <!doctype html>
    <html><body style="font-family:Inter,system-ui,sans-serif;background:#FCF8FF;padding:24px;color:#1C1B1F;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;">
        <h1 style="font-size:24px;margin:0 0 16px;">Ciao ${customerFirstName},</h1>
        <p style="font-size:15px;line-height:1.5;margin:0 0 24px;">${merchantName} ti ha aggiunto al programma fedeltà. Salva la tua tessera digitale per cominciare ad accumulare punti o timbri.</p>
        <a href="${loyaltyUrl}" style="display:inline-block;background:#EFFF74;color:#0a0a0a;padding:14px 28px;border-radius:18px;text-decoration:none;font-weight:700;font-size:16px;">Apri la mia tessera</a>
        <p style="font-size:12px;color:#666;margin:24px 0 0;">Se il bottone non funziona, copia e incolla questo link: ${loyaltyUrl}</p>
      </div>
    </body></html>
  `;

  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set, skipping email to ${to}. URL: ${loyaltyUrl}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error(`[mailer] Resend failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mailer] send failed:", err);
    return false;
  }
}
