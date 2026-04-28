-- Add unique constraint on VoiceAgent.phoneNumber
-- Using a partial index so that NULL phone numbers (agents not yet assigned
-- a number) do not conflict with each other.  Only non-NULL values must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS "VoiceAgent_phoneNumber_key"
  ON "voice_agents"("phoneNumber")
  WHERE "phoneNumber" IS NOT NULL;
