import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — LeadSpot.ai',
  description:
    'How LeadSpot.ai handles personal data captured by the Ghostlog daemon.',
};

/**
 * Public privacy policy. Plain-English. Aim ~500–700 words.
 *
 * Source of truth: tasks/ghostlog-integration-plan.md §11 (Compliance & legal).
 * The daemon allowlist/denylist mirrors src/leadspot/allowlist.ts.
 */
export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-sm prose-zinc max-w-none dark:prose-invert sm:prose-base">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
        Privacy Policy
      </h1>
      <p className="text-xs text-gray-500">Last updated: 2026-04-28</p>

      <p>
        LeadSpot.ai is a CRM whose activity log writes itself from screen
        capture on your Mac. This policy explains exactly what we collect,
        what we never collect, and how long we keep what we have.
      </p>

      <h2>What we collect locally vs in the cloud</h2>
      <p>
        The Ambient daemon runs on your Mac and watches a small allowlist
        of work apps (Gmail, Outlook, Slack, Calendly, Zoom, LinkedIn, and
        a handful of others). When it sees an email address tied to one of
        your existing CRM contacts, it produces a <strong>signal</strong>:
        a short, redacted summary like &ldquo;Email from jane@acme.com&rdquo;
        and a 60-second local hold window during which you can cancel.
      </p>
      <p>
        Only signals tied to <em>known</em> contacts in your CRM ever leave
        your Mac. Unknown emails are kept on-device for up to 90 days
        (30 days if EU strict mode is on) for retroactive matching, then
        deleted.
      </p>

      <h2>What we never collect</h2>
      <p>
        We do not extract anything from password managers, banks, or
        crypto/finance apps. The daemon&rsquo;s denylist (enforced at
        capture time) currently includes:{' '}
        <span className="font-mono text-xs">
          1Password, Bitwarden, LastPass, Dashlane, Keychain Access, Mint,
          Personal Capital, Coinbase, Robinhood, Fidelity, Schwab, Vanguard,
          E*Trade, Ledger Live, MetaMask, Venmo, Cash App
        </span>
        . Window-title rules also block extraction in any incognito tab,
        any window mentioning &ldquo;banking&rdquo;/&ldquo;credit card&rdquo;,
        and remote-desktop / screen-share sessions.
      </p>
      <p>
        We never sell personal information. Ever. Not to advertisers, not
        to data brokers, not to anyone.
      </p>

      <h2>Retention</h2>
      <ul>
        <li>
          <strong>Cloud signals</strong>: kept while your subscription is
          active. 30-day grace period after cancellation, then purged.
        </li>
        <li>
          <strong>Cloud audit log</strong>: 1 year, then purged.
        </li>
        <li>
          <strong>Daemon-local unmatched signals</strong>: 90 days
          (30 days in EU strict mode), then purged.
        </li>
        <li>
          <strong>Daemon-local signal archive</strong>: 1 year, then purged.
        </li>
        <li>
          <strong>Crash reports</strong>: 30 days.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can pause capture, revoke any connected Mac, and toggle EU
        strict mode from{' '}
        <a href="/settings/privacy" className="text-blue-500 hover:underline">
          Settings → Privacy
        </a>
        . Anyone — whether they use LeadSpot or not — can request deletion
        of their data by emailing{' '}
        <a href="mailto:support@leadspot.ai" className="text-blue-500 hover:underline">
          support@leadspot.ai
        </a>
        . We honor deletion requests within 30 days (GDPR-compliant). The
        daemon receives the deletion as a tombstone on the next sync and
        purges its local mirror to match.
      </p>

      <h2>Subprocessors</h2>
      <p>
        The list of third parties who process data on our behalf, as of the
        date above:
      </p>
      <ul>
        <li>
          <strong>Anthropic</strong> — Claude Haiku/Sonnet for activity
          analysis (cloud and on-Mac calls). Never sees raw OCR; only
          short, redacted strings.
        </li>
        <li>
          <strong>Render</strong> — application hosting and Postgres.
        </li>
        <li>
          <strong>Stripe</strong> — billing and subscription management.
        </li>
        <li>
          <strong>Resend</strong> — transactional email delivery.
        </li>
      </ul>
      <p>
        We update this list whenever we add or change a processor. Big
        changes (new model providers, new hosts) get an in-app notice
        before they take effect.
      </p>

      <h2>Encryption</h2>
      <p>
        All data in transit is encrypted (TLS). Database encryption at
        rest is configurable on Render and enabled for our production
        Postgres instance. Refresh tokens for the Ambient daemon live in
        the macOS Keychain, not in plain config files.
      </p>

      <h2>Contacting us</h2>
      <p>
        Privacy questions, deletion requests, or anything you&rsquo;d
        like a person to look at:{' '}
        <a href="mailto:support@leadspot.ai" className="text-blue-500 hover:underline">
          support@leadspot.ai
        </a>
        .
      </p>
    </article>
  );
}
