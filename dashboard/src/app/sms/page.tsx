'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useTenantMauticUrl } from '@/hooks/useTenantConfig';

export default function SMSPage() {
  const { mauticUrl } = useTenantMauticUrl();
  const [twilioConfigured] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">SMS Marketing</h1>
            <p className="text-text-secondary mt-1">Send text messages to your contacts</p>
          </div>
        </div>

        {/* Setup Required Banner */}
        {!twilioConfigured && (
          <div className="bg-accent-purple/10 border border-accent-purple/30 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-purple/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary mb-2">SMS Setup Required</h3>
                <p className="text-text-secondary mb-4">
                  To send SMS messages, you need to configure a Twilio account in your Mautic settings.
                </p>
                <a
                  href={`${mauticUrl}/s/plugins/config/MauticSmsBundle`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configure Twilio
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Setup Steps */}
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Setup Guide</h2>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-accent-cyan/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent-cyan font-semibold text-sm">1</span>
              </div>
              <div>
                <h3 className="text-text-primary font-medium">Create Twilio Account</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Sign up at{' '}
                  <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline">
                    twilio.com
                  </a>
                  {' '}and get your Account SID and Auth Token from the console.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-accent-cyan/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent-cyan font-semibold text-sm">2</span>
              </div>
              <div>
                <h3 className="text-text-primary font-medium">Purchase a Phone Number</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Buy a phone number with SMS capabilities from Twilio&apos;s Phone Numbers section.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-accent-cyan/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent-cyan font-semibold text-sm">3</span>
              </div>
              <div>
                <h3 className="text-text-primary font-medium">Configure Mautic</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Go to Mautic Settings → Plugins → Twilio and enter your credentials.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-accent-cyan/20 flex items-center justify-center flex-shrink-0">
                <span className="text-accent-cyan font-semibold text-sm">4</span>
              </div>
              <div>
                <h3 className="text-text-primary font-medium">Create SMS Templates</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Create text message templates in Mautic to use in your campaigns.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <a
            href={`${mauticUrl}/s/sms/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-bg-secondary rounded-xl border border-border-subtle p-5 hover:border-accent-cyan/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-cyan/10 flex items-center justify-center group-hover:bg-accent-cyan/20 transition-colors">
                <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Create SMS</h3>
                <p className="text-text-secondary text-sm">Compose a new text message</p>
              </div>
            </div>
          </a>

          <a
            href={`${mauticUrl}/s/sms`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-bg-secondary rounded-xl border border-border-subtle p-5 hover:border-accent-purple/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-purple/10 flex items-center justify-center group-hover:bg-accent-purple/20 transition-colors">
                <svg className="w-6 h-6 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">View All SMS</h3>
                <p className="text-text-secondary text-sm">Manage your text messages</p>
              </div>
            </div>
          </a>
        </div>

        {/* Pricing Info */}
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Twilio Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-bg-tertiary rounded-lg">
              <p className="text-2xl font-semibold text-accent-green">$0.0079</p>
              <p className="text-text-muted text-sm mt-1">per outbound SMS (US)</p>
            </div>
            <div className="p-4 bg-bg-tertiary rounded-lg">
              <p className="text-2xl font-semibold text-accent-cyan">$0.0075</p>
              <p className="text-text-muted text-sm mt-1">per inbound SMS (US)</p>
            </div>
            <div className="p-4 bg-bg-tertiary rounded-lg">
              <p className="text-2xl font-semibold text-accent-purple">$1.15/mo</p>
              <p className="text-text-muted text-sm mt-1">per phone number</p>
            </div>
          </div>
          <p className="text-text-muted text-sm mt-4">
            * Prices vary by country. Check{' '}
            <a href="https://www.twilio.com/sms/pricing" target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline">
              Twilio pricing
            </a>
            {' '}for your region.
          </p>
        </div>
      </main>
    </div>
  );
}
