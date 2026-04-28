#!/usr/bin/env tsx
/**
 * Phase 0 — LiveKit SIP Provisioning Script
 *
 * One-time setup that creates all LiveKit SIP resources needed for LeadSpot
 * voice calling:
 *   1. Inbound SIP trunk (Twilio → LiveKit)
 *   2. Outbound SIP trunk (LiveKit → Twilio Elastic SIP Trunk)
 *   3. SIP dispatch rule that routes inbound calls to the voice agent
 *
 * Run with:
 *   cd leadspot/dashboard && npx tsx ../scripts/provision-livekit-sip.ts
 *
 * Required environment variables (set in .env or shell):
 *   LIVEKIT_URL
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 *   TWILIO_ELASTIC_SIP_TRUNK_URI
 *   TWILIO_PHONE_NUMBER
 *   TWILIO_SIP_USERNAME
 *   TWILIO_SIP_PASSWORD
 */

import fs from 'fs';
import path from 'path';
import { SipClient } from 'livekit-server-sdk';
import { SIPTransport } from '@livekit/protocol';

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV_VARS = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'TWILIO_ELASTIC_SIP_TRUNK_URI',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_SIP_USERNAME',
  'TWILIO_SIP_PASSWORD',
] as const;

function validateEnv(): {
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  twilioElasticSipTrunkUri: string;
  twilioPhoneNumber: string;
  twilioSipUsername: string;
  twilioSipPassword: string;
} {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('ERROR: Missing required environment variables:');
    missing.forEach((key) => console.error(`  - ${key}`));
    process.exit(1);
  }

  return {
    livekitUrl: process.env.LIVEKIT_URL!,
    livekitApiKey: process.env.LIVEKIT_API_KEY!,
    livekitApiSecret: process.env.LIVEKIT_API_SECRET!,
    twilioElasticSipTrunkUri: process.env.TWILIO_ELASTIC_SIP_TRUNK_URI!,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER!,
    twilioSipUsername: process.env.TWILIO_SIP_USERNAME!,
    twilioSipPassword: process.env.TWILIO_SIP_PASSWORD!,
  };
}

// ---------------------------------------------------------------------------
// Provisioning
// ---------------------------------------------------------------------------

interface SipConfig {
  inboundTrunkId: string;
  outboundTrunkId: string;
  dispatchRuleId: string;
  provisionedAt: string;
}

async function provision(): Promise<void> {
  console.log('LeadSpot — LiveKit SIP Provisioning');
  console.log('====================================\n');

  const env = validateEnv();
  console.log('Environment variables validated.\n');

  const sip = new SipClient(env.livekitUrl, env.livekitApiKey, env.livekitApiSecret);

  // -------------------------------------------------------------------------
  // Step 1: Inbound SIP trunk
  // Accept calls from all numbers (allowedNumbers: [] means no restriction).
  // -------------------------------------------------------------------------
  console.log('Step 1/3 — Creating inbound SIP trunk...');
  const inboundTrunk = await sip.createSipInboundTrunk('leadspot-inbound', [], {
    allowedNumbers: [],
  });
  const inboundTrunkId = inboundTrunk.sipTrunkId;
  console.log(`  Inbound trunk created: ${inboundTrunkId}\n`);

  // -------------------------------------------------------------------------
  // Step 2: Outbound SIP trunk
  // Points at the Twilio Elastic SIP Trunk URI, authenticates with Twilio SIP
  // credentials, and presents the Twilio phone number as the caller ID.
  // -------------------------------------------------------------------------
  console.log('Step 2/3 — Creating outbound SIP trunk...');
  const outboundTrunk = await sip.createSipOutboundTrunk(
    'leadspot-outbound',
    env.twilioElasticSipTrunkUri,
    [env.twilioPhoneNumber],
    {
      transport: SIPTransport.SIP_TRANSPORT_AUTO,
      authUsername: env.twilioSipUsername,
      authPassword: env.twilioSipPassword,
    },
  );
  const outboundTrunkId = outboundTrunk.sipTrunkId;
  console.log(`  Outbound trunk created: ${outboundTrunkId}\n`);

  // -------------------------------------------------------------------------
  // Step 3: SIP dispatch rule
  // Routes inbound calls to dynamically-named rooms with the prefix "call-".
  // The Python voice agent must register with agentName "leadspot-voice-agent".
  // -------------------------------------------------------------------------
  console.log('Step 3/3 — Creating SIP dispatch rule...');
  const dispatchRule = await sip.createSipDispatchRule(
    { type: 'individual', roomPrefix: 'call-' },
    {
      name: 'leadspot-inbound-dispatch',
      trunkIds: [inboundTrunkId],
      roomConfig: {
        agents: [{ agentName: 'leadspot-voice-agent' }],
      },
    },
  );
  const dispatchRuleId = dispatchRule.sipDispatchRuleId;
  console.log(`  Dispatch rule created: ${dispatchRuleId}\n`);

  // -------------------------------------------------------------------------
  // Save config to file for reference by other scripts
  // -------------------------------------------------------------------------
  const config: SipConfig = {
    inboundTrunkId,
    outboundTrunkId,
    dispatchRuleId,
    provisionedAt: new Date().toISOString(),
  };

  const configPath = path.join(__dirname, '.sip-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`Config saved to: ${configPath}\n`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const inboundSipUri = `sip:${inboundTrunkId}@sip.livekit.cloud`;

  console.log('=======================================================');
  console.log('PROVISIONING COMPLETE — Summary');
  console.log('=======================================================\n');

  console.log(`Inbound SIP URI (paste into Twilio):`);
  console.log(`  ${inboundSipUri}\n`);

  console.log(`Outbound trunk ID (set as LIVEKIT_SIP_OUTBOUND_TRUNK_ID):`);
  console.log(`  ${outboundTrunkId}\n`);

  console.log(`Dispatch rule ID:`);
  console.log(`  ${dispatchRuleId}\n`);

  console.log('-------------------------------------------------------');
  console.log('NEXT STEPS — Twilio Manual Configuration');
  console.log('-------------------------------------------------------\n');
  console.log('1. Log in to console.twilio.com');
  console.log('2. Navigate to: Voice → SIP Trunking → Elastic SIP Trunks');
  console.log('3. Open your Elastic SIP Trunk (the one whose URI you set');
  console.log('   in TWILIO_ELASTIC_SIP_TRUNK_URI).');
  console.log('4. Under "Origination", click "+ Add new Origination URI".');
  console.log(`   Origination URI: ${inboundSipUri}`);
  console.log('   Priority: 1   Weight: 10');
  console.log('   Click Save.');
  console.log('5. Under "Numbers", confirm that TWILIO_PHONE_NUMBER is');
  console.log(`   assigned to this trunk (${env.twilioPhoneNumber}).`);
  console.log('6. Add LIVEKIT_SIP_OUTBOUND_TRUNK_ID to your dashboard .env:');
  console.log(`   LIVEKIT_SIP_OUTBOUND_TRUNK_ID=${outboundTrunkId}`);
  console.log('7. Restart the dashboard service to pick up the new env var.');
  console.log('\nProvisioning finished successfully.\n');
}

provision().catch((err: unknown) => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
