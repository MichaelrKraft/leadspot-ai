import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — LeadSpot AI',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-sm text-[#a0a0a0] hover:text-[#00D9FF] transition-colors mb-6 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-semibold text-white mb-3">Privacy Policy</h1>
          <p className="text-[#a0a0a0] text-sm">Last updated: March 2026</p>
        </div>

        <div className="space-y-10 text-[#d0d0d0] leading-relaxed">
          {/* Introduction */}
          <section>
            <p>
              LeadSpot AI (&quot;we&quot;, &quot;our&quot;, or &quot;the platform&quot;) is committed
              to protecting your privacy and complying with applicable data protection laws,
              including the General Data Protection Regulation (GDPR). This policy explains
              what data we collect, why we collect it, and your rights as a data subject.
            </p>
          </section>

          {/* Data We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-[#2a2a2a] pb-2">
              Data We Collect
            </h2>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Account information</strong> — your name and
                  email address, collected when you register for the platform.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Voice call recordings and transcripts</strong>{' '}
                  — when your AI voice agents conduct calls, the audio is processed in real time
                  and a text transcript is stored. Calls are not retained as audio files; only
                  the transcript and metadata (duration, outcome) are saved.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Usage and billing data</strong> — call minutes,
                  wallet balance, and transaction history to support billing and account
                  management.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Contact records</strong> — leads and customer
                  profiles stored in your connected Mautic instance. This data is provided
                  by you and processed on your behalf.
                </span>
              </li>
            </ul>
          </section>

          {/* How We Use Your Data */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-[#2a2a2a] pb-2">
              How We Use Your Data
            </h2>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Marketing automation</strong> — syncing leads
                  to your Mautic instance, triggering campaigns, and tracking engagement.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Lead qualification</strong> — AI voice agents
                  conduct structured conversations to qualify leads based on your configured
                  criteria.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Billing</strong> — calculating per-minute usage
                  costs and maintaining your wallet balance.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Platform improvement</strong> — aggregated,
                  anonymised analytics to improve system performance. We do not sell your data.
                </span>
              </li>
            </ul>
          </section>

          {/* Call Transcription Disclosure */}
          <section className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[#00D9FF] mb-3">
              Important: Call Transcription
            </h2>
            <p>
              All voice calls made by your AI agents are automatically transcribed using
              speech-to-text technology. By using the Voice AI feature, you confirm that
              you have obtained appropriate consent from call recipients where required
              by law (e.g., informing them that the call is recorded or processed by AI).
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-[#2a2a2a] pb-2">
              Your Rights (GDPR)
            </h2>
            <p className="mb-4">
              If you are located in the European Economic Area or United Kingdom, you have the
              following rights regarding your personal data:
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Right of access</strong> — you can download a
                  complete export of all data we hold about you.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Right to erasure</strong> — you can request
                  deletion of your account and all associated data, including call transcripts.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Right to rectification</strong> — you can
                  correct inaccurate personal data via your account settings.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00D9FF] mt-1 shrink-0">▸</span>
                <span>
                  <strong className="text-white">Right to portability</strong> — export your
                  data in machine-readable JSON format using the link below.
                </span>
              </li>
            </ul>

            {/* Data Export Link */}
            <div className="mt-6 p-4 bg-[#141414] border border-[#00D9FF]/30 rounded-xl">
              <p className="text-sm text-[#a0a0a0] mb-3">
                Download a full export of all personal data associated with your account:
              </p>
              <a
                href="/api/user/export"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D9FF]/10 border border-[#00D9FF]/50 text-[#00D9FF] rounded-lg text-sm font-medium hover:bg-[#00D9FF]/20 transition-colors"
              >
                Download My Data (JSON)
              </a>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-[#2a2a2a] pb-2">
              Data Retention
            </h2>
            <p>
              We retain your data for as long as your account is active. When you delete your
              account, all personal data including call transcripts, usage records, and billing
              history is permanently deleted within 30 days. Certain records may be retained
              for longer periods to comply with legal or regulatory obligations.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-[#2a2a2a] pb-2">
              GDPR Requests &amp; Contact
            </h2>
            <p>
              To exercise any of your rights, or if you have questions about how we handle
              your data, please contact our Data Protection team at:
            </p>
            <a
              href="mailto:privacy@leadspot.ai"
              className="mt-3 inline-block text-[#00D9FF] hover:underline"
            >
              privacy@leadspot.ai
            </a>
            <p className="mt-4 text-sm text-[#a0a0a0]">
              We will respond to all legitimate requests within 30 days. If you are unsatisfied
              with our response, you have the right to lodge a complaint with your local
              supervisory authority.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
