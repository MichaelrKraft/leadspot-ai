import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security — LeadSpot.ai',
  description: 'Architecture and security overview of the Ghostlog daemon and LeadSpot.ai cloud.',
};

/**
 * Public-facing security overview. Includes a textual architecture diagram
 * and a bug-bounty contact. See plan §11 (compliance) and §13 (observability).
 */
export default function SecurityPage() {
  return (
    <article className="prose prose-sm prose-zinc max-w-none dark:prose-invert sm:prose-base">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
        Security
      </h1>
      <p className="text-xs text-gray-500">Last updated: 2026-04-28</p>

      <p>
        Privacy is the architecture of LeadSpot.ai, not a footnote. The
        diagram below shows where data lives at each step of the Ghostlog
        capture flow.
      </p>

      <h2>Data flow</h2>
      <div className="not-prose my-6 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:p-6 sm:text-sm">
        <pre className="whitespace-pre">{`+------------------------------+
|         Your Mac             |
|                              |
|  Screenpipe (OCR)            |
|         |                    |
|         v                    |
|  Allowlist + denylist gate   |
|         |  (drops banking,   |
|         |   1Password, etc.) |
|         v                    |
|  Haiku 4.5 -> redaction      |
|         |                    |
|         v                    |
|  SQLite (60s local hold)     |
|         |                    |
|         v   (cancel-able)    |
+---------|--------------------+
          |
          | TLS 1.3 over HTTPS
          v
+------------------------------+
|        LeadSpot Cloud        |
|                              |
|   FastAPI ingest             |
|         |                    |
|         v                    |
|   Postgres (encrypted at     |
|   rest; row-level org scope) |
|         |                    |
|         v                    |
|   Per-contact timeline       |
+------------------------------+`}</pre>
      </div>

      <h2>What this gives you</h2>
      <ul>
        <li>
          <strong>Default-deny extraction.</strong> The daemon only runs
          signal extraction on apps that are explicitly on the allowlist.
          New apps are silent until you (or we) add them.
        </li>
        <li>
          <strong>60-second local hold.</strong> Every signal sits on your
          Mac for 60 seconds before promotion to the cloud. During that
          window you can cancel it via a notification toast.
        </li>
        <li>
          <strong>No raw OCR leaves the Mac.</strong> What gets promoted
          is a short, redacted summary string and a hash of the OCR
          snippet (used for audit, never reversible).
        </li>
      </ul>

      <h2>Encryption</h2>
      <ul>
        <li>
          <strong>In transit:</strong> TLS 1.2+ on every external
          connection (browser ↔ cloud, daemon ↔ cloud, daemon ↔ Anthropic).
        </li>
        <li>
          <strong>At rest:</strong> Postgres encryption at rest is
          configurable on Render and is enabled for our production
          instance. Daemon SQLite databases live in your home directory
          (not encrypted by default — protected by macOS account
          permissions).
        </li>
        <li>
          <strong>Refresh tokens:</strong> stored in the macOS Keychain
          on the daemon side; hashed before storage server-side. Refresh
          rotation is race-safe with a 60-second grace window for
          parallel refresh attempts.
        </li>
      </ul>

      <h2>Authentication</h2>
      <ul>
        <li>
          User accounts use bcrypt-hashed passwords and short-lived JWT
          access tokens (1-hour TTL).
        </li>
        <li>
          The Ambient daemon uses loopback OAuth and rotates a refresh
          token every 15 minutes. Tokens have an{' '}
          <code className="font-mono">aud=leadspot-daemon</code> claim
          and cannot be substituted for user-session tokens.
        </li>
        <li>
          You can revoke any connected Mac from{' '}
          <a href="/settings/privacy" className="text-blue-500 hover:underline">
            Settings → Privacy
          </a>
          ; revocation takes effect on the daemon&rsquo;s next refresh
          (≤15 minutes worst case).
        </li>
      </ul>

      <h2>Vulnerability reporting</h2>
      <p>
        We want to hear from you. If you find a security issue, please
        email{' '}
        <a href="mailto:security@leadspot.ai" className="text-blue-500 hover:underline">
          security@leadspot.ai
        </a>{' '}
        with reproduction steps. We acknowledge within one business day
        and aim to triage within five. We do not currently offer a paid
        bug bounty, but we do publicly credit reporters who&rsquo;d like
        the recognition (with your permission).
      </p>

      <p>
        Customer-affecting incidents are disclosed under our DPA breach
        notification commitments — see the{' '}
        <a href="/dpa" className="text-blue-500 hover:underline">
          Data Processing Addendum
        </a>{' '}
        for details.
      </p>
    </article>
  );
}
