/**
 * One-time seed script: creates the GoAutomated.ai Tipping Point plans
 * for Mike's org in the agent-service SQLite database.
 *
 * Run with: npx ts-node scripts/seed-goautomated-plans.ts
 */
import { createGoAutomatedPlans, getActionPlans } from '../src/action-plans';

const ORG_ID = '9c36c991-8b84-4e76-b092-8c2a1f20b536';

createGoAutomatedPlans(ORG_ID);

const plans = getActionPlans(ORG_ID).filter(
  (p) => p.name === 'Scale Tipper Sequence' || p.name === '90-Day Follow-Up',
);

if (plans.length === 0) {
  console.error('ERROR: Plans were not created.');
  process.exit(1);
}

for (const plan of plans) {
  console.log(`Created: "${plan.name}" (${plan.steps.length} steps) — id: ${plan.id}`);
}
