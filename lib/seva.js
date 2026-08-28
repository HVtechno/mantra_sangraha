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

// Build a UPI deep link that opens GPay / PhonePe / Paytm etc.
export function upiLink(amount) {
  const p = new URLSearchParams();
  p.set('pa', SEVA.upiId);
  p.set('pn', SEVA.payee || 'Mantra Sangraha');
  if (amount) p.set('am', String(amount));
  p.set('cu', 'INR');
  p.set('tn', 'Seva • Mantra Sangraha');
  return `upi://pay?${p.toString()}`;
}
