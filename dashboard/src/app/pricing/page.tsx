'use client';

import Link from 'next/link';

const PRICING_TIERS = [
  {
    name: 'Pay As You Go',
    price: '$0.10',
    unit: 'per minute',
    description: 'Perfect for getting started',
    features: [
      '$5 welcome credit (50 free minutes)',
      'No monthly fees',
      'All voice agent types',
      'Real-time call analytics',
      'CRM integration (Mautic)',
      'SMS notifications',
    ],
    cta: 'Start Free',
    ctaLink: '/billing',
    highlighted: true,
  },
  {
    name: 'Starter Pack',
    price: '$25',
    unit: '250 minutes',
    description: 'Save 10% with bulk minutes',
    features: [
      '250 voice minutes',
      '$0.10/min effective rate',
      'Priority support',
      'Custom agent prompts',
      'Webhook integrations',
      'Call recordings',
    ],
    cta: 'Buy Minutes',
    ctaLink: '/billing',
    highlighted: false,
  },
  {
    name: 'Growth Pack',
    price: '$89',
    unit: '1,000 minutes',
    description: 'Best value for high volume',
    features: [
      '1,000 voice minutes',
      '$0.089/min effective rate',
      'Dedicated support',
      'White-label options',
      'API access',
      'Advanced analytics',
    ],
    cta: 'Buy Minutes',
    ctaLink: '/billing',
    highlighted: false,
  },
];

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI-Powered Agents',
    description: 'Lead qualification, appointment booking, and customer support agents powered by GPT-4.',
  },
  {
    icon: '📞',
    title: 'Real Phone Calls',
    description: 'Handle inbound and outbound calls with natural voice conversations.',
  },
  {
    icon: '📊',
    title: 'Live Analytics',
    description: 'Track call outcomes, qualified leads, and appointments in real-time.',
  },
  {
    icon: '🔗',
    title: 'CRM Integration',
    description: 'Automatically sync contacts and call data with your Mautic CRM.',
  },
  {
    icon: '📅',
    title: 'Calendar Booking',
    description: 'Agents can book appointments directly on your Google Calendar.',
  },
  {
    icon: '💬',
    title: 'SMS Follow-up',
    description: 'Send automated text messages after calls via Twilio.',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-mautic-blue">Ploink</span>
              <span className="text-sm bg-mautic-blue/10 text-mautic-blue px-2 py-0.5 rounded-full">
                Voice AI
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/voice-ai"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/billing"
                className="bg-mautic-blue text-white px-4 py-2 rounded-lg hover:bg-mautic-blue-dark transition font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Voice AI That Closes Deals
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Automate lead qualification, book appointments, and provide 24/7 customer support
          with AI-powered voice agents.
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <span className="text-green-500">✓</span> No monthly fees
          </span>
          <span className="flex items-center gap-1">
            <span className="text-green-500">✓</span> $5 free credit
          </span>
          <span className="flex items-center gap-1">
            <span className="text-green-500">✓</span> Cancel anytime
          </span>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-8 ${
                tier.highlighted
                  ? 'bg-mautic-blue text-white ring-4 ring-mautic-blue/20 scale-105'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-2 ${
                  tier.highlighted ? 'text-white' : 'text-gray-900'
                }`}
              >
                {tier.name}
              </h3>
              <div className="mb-4">
                <span
                  className={`text-4xl font-bold ${
                    tier.highlighted ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {tier.price}
                </span>
                <span
                  className={`text-sm ml-1 ${
                    tier.highlighted ? 'text-white/80' : 'text-gray-500'
                  }`}
                >
                  {tier.unit}
                </span>
              </div>
              <p
                className={`text-sm mb-6 ${
                  tier.highlighted ? 'text-white/80' : 'text-gray-500'
                }`}
              >
                {tier.description}
              </p>
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className={`flex items-start gap-2 text-sm ${
                      tier.highlighted ? 'text-white/90' : 'text-gray-600'
                    }`}
                  >
                    <span className={tier.highlighted ? 'text-white' : 'text-green-500'}>
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.ctaLink}
                className={`block w-full text-center py-3 rounded-lg font-medium transition ${
                  tier.highlighted
                    ? 'bg-white text-mautic-blue hover:bg-gray-100'
                    : 'bg-mautic-blue text-white hover:bg-mautic-blue-dark'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Cost Calculator */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gray-900 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Your Cost vs. Human Agents
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto mt-8">
            <div className="bg-white/10 rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-2">Human Agent</p>
              <p className="text-3xl font-bold text-white">$15-25/hr</p>
              <p className="text-gray-400 text-sm mt-2">+ Benefits, training, turnover</p>
            </div>
            <div className="bg-mautic-blue rounded-xl p-6">
              <p className="text-white/80 text-sm mb-2">Ploink Voice AI</p>
              <p className="text-3xl font-bold text-white">$6/hr</p>
              <p className="text-white/80 text-sm mt-2">24/7 availability, instant scale</p>
            </div>
          </div>
          <p className="text-gray-400 mt-8 text-sm">
            Based on $0.10/min = $6/hr. Human agent costs vary by region.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-12">
          Everything You Need
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="text-center">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-mautic-blue rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Automate Your Calls?
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Start with $5 free credit. No credit card required.
            Set up your first AI agent in minutes.
          </p>
          <Link
            href="/billing"
            className="inline-block bg-white text-mautic-blue px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Start Free Trial →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          <p>© 2025 Ploink. Powered by LiveKit & Mautic.</p>
        </div>
      </footer>
    </div>
  );
}
