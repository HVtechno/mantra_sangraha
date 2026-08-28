// lib/seva.js
// Configuration for the optional "Seva" (voluntary offering). This gates NOTHING
// in the app — it is a pure donation, so it can use UPI directly (no Play Billing).
//
// The UPI ID lives in an env var, NOT in this file. Set it in .env.local (local)
// and in your Render environment (production):
//
//     NEXT_PUBLIC_SEVA_UPI=yourname@oksbi
//     NEXT_PUBLIC_SEVA_PAYEE=Mantra Sangraha   (optional; defaults below)
//
// NEXT_PUBLIC_ vars are read by the browser (the UPI link is built client-side).
// A UPI ID is your public payment address — not a secret — so this is fine.
// Note: NEXT_PUBLIC_ values are baked in at BUILD time, so rebuild/redeploy after
// changing them. Until a UPI ID is set, the Seva button stays in "coming soon"
// mode (it still counts interest but does not open a UPI app).
export const SEVA = {
  upiId: process.env.NEXT_PUBLIC_SEVA_UPI || '',
  payee: process.env.NEXT_PUBLIC_SEVA_PAYEE || 'Mantra Sangraha',
  amounts: [11, 21, 51, 101],   // preset offering amounts (₹)
};

// True once a real UPI ID has been set in the environment.
export function sevaConfigured() {
  return !!SEVA.upiId && SEVA.upiId.includes('@');
}

// Specific UPI apps. Each has its OWN link scheme, so tapping "PhonePe" can only
// open PhonePe (unlike the shared upi:// scheme, which the phone routes to
// whichever UPI app — sometimes WhatsApp — is set as the default handler).
export const SEVA_APPS = [
  { key: 'gpay', label: 'Google Pay', base: 'tez://upi/pay' },
  { key: 'phonepe', label: 'PhonePe', base: 'phonepe://pay' },
  { key: 'paytm', label: 'Paytm', base: 'paytmmp://pay' },
  { key: 'other', label: 'Other UPI app', base: 'upi://pay' },
];

// Build a UPI deep link. `base` defaults to the shared upi:// scheme; pass an
// app-specific base (e.g. 'phonepe://pay') to target one app.
export function upiLink(amount, base) {
  const p = new URLSearchParams();
  p.set('pa', SEVA.upiId);
  p.set('pn', SEVA.payee || 'Mantra Sangraha');
  if (amount) p.set('am', String(amount));
  p.set('cu', 'INR');
  p.set('tn', 'Seva Mantra Sangraha');
  return `${base || 'upi://pay'}?${p.toString()}`;
}
