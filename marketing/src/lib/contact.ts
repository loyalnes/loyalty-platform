/**
 * Single source of truth for contact channels used on the marketing site.
 * Update here only — referenced by the contact page, the floating WhatsApp
 * button, and any CTA that should ping us.
 */

export const WHATSAPP_NUMBER = '+34634716447';
export const CONTACT_EMAIL = 'Loyalicustomer@gmail.com';

/**
 * Builds a wa.me URL with an optional pre-filled message. Numbers are passed
 * with the leading '+' stripped, as wa.me expects.
 */
export function whatsappUrl(prefilledMessage?: string): string {
  const number = WHATSAPP_NUMBER.replace(/[^0-9]/g, '');
  const text = prefilledMessage
    ? `?text=${encodeURIComponent(prefilledMessage)}`
    : '';
  return `https://wa.me/${number}${text}`;
}
