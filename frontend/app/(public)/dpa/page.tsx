import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Processing Addendum — LeadSpot.ai',
  description:
    'B2B Data Processing Addendum template for LeadSpot.ai customers.',
};

/**
 * Data Processing Addendum (DPA) template — boilerplate that any B2B
 * customer can read or have their legal team review.
 *
 * BLOCKED ON LEGAL: a signed/PDF version requires real legal review. For
 * now we expose this template page and an email-to-execute button. See
 * §11.1 of the Ghostlog plan.
 */
export default function DPAPage() {
  return (
    <article className="prose prose-sm prose-zinc max-w-none dark:prose-invert sm:prose-base">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
        Data Processing Addendum
      </h1>
      <p className="text-xs text-gray-500">Last updated: 2026-04-28</p>

      <div className="not-prose mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <strong>Need a signed copy?</strong> Email{' '}
        <a href="mailto:support@leadspot.ai" className="underline">
          support@leadspot.ai
        </a>{' '}
        from your business address and we&rsquo;ll send a counter-signed
        PDF within one business day.
      </div>

      <p>
        This Data Processing Addendum (&ldquo;DPA&rdquo;) forms part of the
        LeadSpot.ai Terms of Service between LeadSpot.ai (&ldquo;Processor&rdquo;)
        and the customer organization (&ldquo;Controller&rdquo;) and applies
        whenever the Processor processes Personal Data on the Controller&rsquo;s
        behalf.
      </p>

      <h2>1. Definitions</h2>
      <p>
        Capitalized terms not defined here have the meaning given in the EU
        General Data Protection Regulation 2016/679 (&ldquo;GDPR&rdquo;) and,
        where applicable, the UK GDPR and California Consumer Privacy Act
        (&ldquo;CCPA&rdquo;).
      </p>

      <h2>2. Subject matter and duration</h2>
      <p>
        Subject matter: processing of Personal Data observed in screen
        capture on Controller-authorized devices, redacted, and stored
        as activity signals tied to the Controller&rsquo;s CRM contacts.
        Duration: for as long as the Controller&rsquo;s subscription is
        active, plus a 30-day grace period after termination.
      </p>

      <h2>3. Processor obligations</h2>
      <ul>
        <li>
          Process Personal Data only on documented instructions from the
          Controller (the configuration of the LeadSpot.ai service, this
          DPA, and the Terms).
        </li>
        <li>
          Ensure persons authorized to process Personal Data are bound by
          confidentiality obligations.
        </li>
        <li>
          Implement appropriate technical and organizational measures (see
          §6 below) to protect Personal Data against unauthorized access,
          loss, or alteration.
        </li>
        <li>
          Assist the Controller in meeting its obligations under Articles
          32–36 GDPR (security, breach notification, DPIA, prior
          consultation).
        </li>
      </ul>

      <h2>4. Sub-processors</h2>
      <p>
        The Controller authorizes engagement of the sub-processors listed
        on the{' '}
        <a href="/privacy" className="text-blue-500 hover:underline">
          Privacy Policy
        </a>
        . The Processor will provide at least 30 days&rsquo; notice of any
        new sub-processor; the Controller may object in writing.
      </p>

      <h2>5. International transfers</h2>
      <p>
        Where Personal Data is transferred outside the EEA/UK/Switzerland,
        the parties agree that the European Commission&rsquo;s Standard
        Contractual Clauses (Module Two: Controller-to-Processor),
        published in Implementing Decision (EU) 2021/914 of 4 June 2021,
        are incorporated by reference and form part of this DPA. The UK
        International Data Transfer Addendum applies to UK-originating
        data.
      </p>

      <h2>6. Security measures</h2>
      <p>
        The Processor implements at minimum: TLS 1.2+ for data in transit;
        database encryption at rest; least-privilege access controls;
        audit logging of administrative actions; secure
        sub-processor selection; and macOS Keychain storage for daemon
        refresh tokens. A list of current measures is available on
        request.
      </p>

      <h2>7. Personal Data breach</h2>
      <p>
        The Processor will notify the Controller without undue delay
        (target: within 72 hours) of becoming aware of a Personal Data
        breach affecting Controller data, with the information required
        by Article 33(3) GDPR.
      </p>

      <h2>8. Data subject rights</h2>
      <p>
        The Processor will assist the Controller in responding to requests
        from data subjects exercising rights under Articles 15–22 GDPR.
        The Processor provides a self-service deletion endpoint at{' '}
        <a href="/settings/privacy" className="text-blue-500 hover:underline">
          /settings/privacy
        </a>{' '}
        and an email intake at{' '}
        <a href="mailto:support@leadspot.ai" className="text-blue-500 hover:underline">
          support@leadspot.ai
        </a>{' '}
        with a 30-day SLA.
      </p>

      <h2>9. Audits</h2>
      <p>
        Subject to confidentiality, the Controller (or its agreed
        independent auditor) may, no more than once per 12-month period
        and on at least 30 days&rsquo; written notice, audit the
        Processor&rsquo;s compliance with this DPA. The Processor may
        satisfy this obligation by providing recent third-party audit
        reports (e.g., SOC 2) where available.
      </p>

      <h2>10. Return or deletion</h2>
      <p>
        On termination of the subscription, the Processor will (at the
        Controller&rsquo;s option) return or delete all Personal Data
        within 30 days. Backup copies are deleted on the regular backup
        rotation, not exceeding 90 days.
      </p>

      <h2>11. Liability and governing law</h2>
      <p>
        Liability under this DPA is governed by the LeadSpot.ai Terms of
        Service. To the extent of any conflict between this DPA and the
        Terms, this DPA prevails for matters relating to the processing
        of Personal Data.
      </p>

      <p className="text-xs text-gray-500">
        This page is a template provided in good faith. It is not legal
        advice. Have your counsel review before relying on it.
      </p>

      <div className="not-prose mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') window.print();
          }}
          className="rounded-lg border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Print / save as PDF
        </button>
        <a
          href="mailto:support@leadspot.ai?subject=DPA%20signature%20request"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          Email for signed copy
        </a>
      </div>
    </article>
  );
}
