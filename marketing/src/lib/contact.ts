/**
 * Single source of truth for contact channels used on the marketing site.
 * Update here only — referenced by the contact page, the floating WhatsApp
 * button, and any CTA that should ping us.
 */

export const WHATSAPP_NUMBER = '+34634716447';
// Mailbox where every contact-form / newsletter signup actually lands.
// FormSubmit relays here.
export const CONTACT_EMAIL = 'loyalicustomer@gmail.com';
// Branded address shown in the footer (set up email forwarding so this
// arrives at CONTACT_EMAIL, otherwise messages to it are lost).
export const FOOTER_EMAIL = 'hello@loyali.online';
export const FOOTER_PHONE = '+34 634 716 447';
export const FOOTER_LOCATION = 'Madrid, Spain';

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
