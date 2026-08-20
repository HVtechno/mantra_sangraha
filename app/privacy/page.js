// app/privacy/page.js
// Privacy policy — served at /privacy. Also used as the Play Store "Privacy
// policy" URL. Written to reflect what the app ACTUALLY does. If you ever add
// analytics (e.g. Google Analytics) or accounts, update the relevant sections.
export const metadata = {
  title: 'Privacy Policy — Mantra Sangraha',
  description: 'How Mantra Sangraha handles your data: no accounts, no ads, no tracking.',
};

export default function Privacy() {
  return (
    <main className="legal">
      <a className="legal-back" href="/">← Mantra Sangraha</a>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: 19 August 2026</p>

      <p>
        Mantra Sangraha is an ad-free, offline-first app for reading Hindu mantras
        and slokas. It is built to respect your privacy: there are <b>no user
        accounts, no advertising, and no third-party tracking</b>. This policy
        explains, in plain language, what little data is involved and how it is
        handled.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>We don’t ask you to sign in, and we don’t know who you are.</li>
        <li>Your personal book, settings, and downloads stay <b>on your device</b>.</li>
        <li>We show no ads and use no advertising or analytics SDKs.</li>
        <li>The only thing you can send us is optional feedback, and it’s anonymous.</li>
      </ul>

      <h2>Information stored on your device</h2>
      <p>
        Your saved mantras (“your book”), reading preferences, chosen language,
        muted/unmuted state, and any recitations you download for offline use are
        stored locally on your device (in your browser’s storage / IndexedDB).
        This information stays on your device — it is not transmitted to us and we
        cannot see it. Clearing the app’s data or uninstalling removes it.
      </p>

      <h2>Feedback and mantra requests</h2>
      <p>
        If you use the in-app “Suggest / Feedback” feature, we store what you
        submit so we can act on it: the text of your request or feedback, an
        optional star rating, the app language and version, and a random,
        app-generated identifier that is not linked to your identity. If you
        choose to add a contact (this is optional), we store what you type so we
        can reply. We do <b>not</b> collect your name, email, phone number,
        precise location, or IP address through this feature. Submissions are
        stored with our hosting provider (see below) and are not sold or shared
        with advertisers.
      </p>

      <h2>Content the app fetches</h2>
      <p>
        Mantra Sangraha does not pre-store a large library. When you open a mantra,
        the app fetches its text on demand from open, public-domain sources (such
        as vignanam.org and Wikisource) and plays optional recitations streamed
        from the Internet Archive (archive.org). When you use the “Feeling” (Bhava)
        mood search, the words you type there are sent to an AI provider (OpenAI)
        to suggest matching chants. As with any internet request, these third
        parties receive standard technical information (such as your device’s IP
        address and request details) needed to deliver the content; their handling
        of that data is governed by their own privacy policies. The app also loads
        an icon font from a public CDN (jsDelivr).
      </p>

      <h2>Hosting and storage providers</h2>
      <p>
        The app and its small backend run on Render (hosting). Feedback submissions
        are stored using Upstash (a serverless database). These providers process
        data on our behalf to run the service.
      </p>

      <h2>Analytics and advertising</h2>
      <p>
        The app contains <b>no advertising and no third-party analytics or tracking
        SDKs</b>. We do not build advertising profiles and we do not track you
        across other apps or websites.
      </p>

      <h2>Children</h2>
      <p>
        Mantra Sangraha is a general-audience app and is not directed to children
        under 13. We do not knowingly collect personal information from children.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        On-device data remains until you clear it or uninstall the app. Feedback
        submissions are retained only as long as needed to act on them; older
        feedback is periodically archived. To request deletion of a submission you
        made, contact us at the address below and we will remove it.
      </p>

      <h2>Security</h2>
      <p>
        Connections use HTTPS. Because there are no accounts and we collect no
        sensitive personal data, the privacy risk to you is minimal by design.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy as the app evolves. Material changes will be
        reflected here with a new “last updated” date.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests about your data? Contact us at{' '}
        <a href="mailto:REPLACE_WITH_YOUR_CONTACT_EMAIL">REPLACE_WITH_YOUR_CONTACT_EMAIL</a>.
      </p>
    </main>
  );
}
