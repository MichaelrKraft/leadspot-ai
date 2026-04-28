/**
 * Seeds GoAutomated.ai Tipping Point workflows into the workflows system
 * (the one the UI actually shows).
 *
 * Run: node scripts/seed-workflows.js
 */
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');
const path = require('path');

const ORG_ID = '9c36c991-8b84-4e76-b092-8c2a1f20b536';
const DB_PATH = path.join(__dirname, `../data/orgs/${ORG_ID}/agent.db`);

const db = new Database(DB_PATH);

// Ensure workflows tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS workflow_steps (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    delay_days INTEGER NOT NULL DEFAULT 0,
    subject TEXT NOT NULL,
    body TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workflow_enrollments (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
    next_send_at TEXT
  );
`);

function createWorkflow(name, steps) {
  const existing = db.prepare('SELECT id FROM workflows WHERE name = ?').get(name);
  if (existing) {
    console.log(`Skipped (already exists): "${name}"`);
    return;
  }

  const id = randomUUID();
  db.prepare('INSERT INTO workflows (id, name) VALUES (?, ?)').run(id, name);

  const insertStep = db.prepare(
    'INSERT INTO workflow_steps (id, workflow_id, step_order, delay_days, subject, body) VALUES (?, ?, ?, ?, ?, ?)'
  );
  steps.forEach((step, i) => {
    insertStep.run(randomUUID(), id, i, step.delayDays, step.subject, step.body);
  });

  console.log(`Created: "${name}" (${steps.length} steps) — id: ${id}`);
}

// --- Scale Tipper Sequence ---
createWorkflow('Scale Tipper Sequence', [
  {
    delayDays: 1,
    subject: 'He almost cancelled before he saw this...',
    body: `Hi {firstName},

I want to share something before our call.

One of my clients — a professional services firm owner — had been burned twice by consultants who over-promised and under-delivered. He almost didn't book our call. He figured automation was just another vendor selling complexity.

He gave it one more shot. Within 8 weeks, his client intake process went from 6 hours to 15 minutes — saving $180,000 a year. He told me: "I wish I'd done this two years ago."

See you on our call.

Mike
Go Automated`,
  },
  {
    delayDays: 1,
    subject: "She made the decision on the first call. Here's what happened next.",
    body: `Hi {firstName},

Quick one before we meet.

Another client — an operations manager at a growing company — didn't overthink it. She'd already seen how much time her team wasted on manual reports. She said yes on the first call.

Four weeks later, reports that took 40 hours a month took 2 hours. Her team stopped dreading Fridays.

$95,000 in annual savings before most people would have "finished thinking about it."

See you soon.

Mike
Go Automated`,
  },
  {
    delayDays: 1,
    subject: "The leads were great. But that wasn't the real change.",
    body: `Hi {firstName},

One more story before we connect.

A founder came in wanting to save time. Six months later, he told me: "The automations are great, but what really changed is that I finally feel like a CEO. I'm not the bottleneck anymore."

That's what this is really about. Not just hours saved — it's about building a business that runs without you holding it together.

Looking forward to our call.

Mike
Go Automated`,
  },
]);

// --- 90-Day Follow-Up ---
createWorkflow('90-Day Follow-Up', [
  {
    delayDays: 0,
    subject: 'Something I noticed from our conversation',
    body: `Hi {firstName},

I've been thinking about what you shared on our call.

The bottleneck you described is something I see holding back a lot of operations teams. What's usually underneath it isn't a tool problem — it's a process problem that looks like a tool problem.

Worth keeping in mind as you think through your options.

No agenda. Just sharing what I noticed.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'A quick win you can use this week (no strings)',
    body: `Hi {firstName},

Whether we end up working together or not, here's something you can implement today:

Map out the top 3 tasks your team repeats every week that don't require judgment — just data entry, copy-paste, or status updates. Time them. Multiply by 52.

That number is your automation opportunity in hours per year. Most companies are surprised by it.

If you want, reply with your number. I'm happy to tell you which ones are easiest to automate first.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'Why I got into this (the honest version)',
    body: `Hi {firstName},

I started Go Automated because I watched smart companies waste years on work that software could handle in seconds.

Not because they were inefficient. Because nobody had ever mapped it out for them.

The $500 audit exists because I believe you should see exactly what's possible before you commit to anything. No vague promises. Just a clear map.

That's the whole pitch.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'Case study: 6 hours → 15 minutes',
    body: `Hi {firstName},

A professional services firm was spending 6 hours on client intake for every new client. Forms, data entry, CRM updates, calendar scheduling — all manual.

We automated it. Now it takes 15 minutes. Most of that is the client filling out the form.

Annual savings: $180,000. Zero new hires.

The pattern holds across industries. Curious what your equivalent looks like?

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'The automation most businesses overlook',
    body: `Hi {firstName},

The automations that get the most attention are the flashy ones — AI chatbots, voice agents, that kind of thing.

The ones that actually move the needle are boring: report generation, invoice processing, lead routing, follow-up sequences.

The boring ones compound quietly. Most companies are sitting on $100K+ in recoverable hours from boring automations alone.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'Tool recommendation (genuinely useful)',
    body: `Hi {firstName},

One tool I recommend to almost every client before we build anything custom: n8n.

It's open source, self-hostable, and handles 80% of business automation needs without any code. If you want to experiment before investing, it's the best starting point.

Happy to point you toward which workflows to try first.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'The real cost of manual work',
    body: `Hi {firstName},

Quick math:

An $80K employee spending 30% of their time on automatable tasks = $24,000/year in recoverable cost.

10 employees: $240,000.

That's consistent with what we find in almost every audit.

The question isn't whether the opportunity is there. It's whether now is the right time to go get it.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'What happened when they stopped manually generating reports',
    body: `Hi {firstName},

A company was spending 40 hours a month generating reports. Someone pulled data from three systems, formatted it in Excel, emailed it to leadership.

We automated the whole thing. Now it's 2 hours a month — just review and send.

$95K saved annually. The person who used to do it? Now running a project they'd been shelving for two years.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'One more quick win',
    body: `Hi {firstName},

If you have a CRM and an email system that don't talk to each other, that gap is costing you leads.

Every time someone fills out a form and your team manually copies it to the CRM, there's a chance of a data error or a delay that costs you the lead.

A simple Zapier or Make integration fixes it in under an hour.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: "What 'I finally feel like a CEO' actually looks like",
    body: `Hi {firstName},

The clients who get the most out of automation aren't always the ones who save the most hours.

They're the ones who use those hours to do work only they can do.

One client told me: "I used to spend Mondays catching up. Now I spend them planning." That's a different kind of business.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'Results across the board',
    body: `Hi {firstName},

In case the numbers help:

- Client intake: 6 hrs → 15 min ($180K saved)
- Monthly reporting: 40 hrs → 2 hrs ($95K saved)
- Lead follow-up: 0% automated → 100% automated (3x conversion lift)
- Invoice processing: 8 hrs/week → 30 min/week

These aren't outliers. These are medians.

Mike
Go Automated`,
  },
  {
    delayDays: 7,
    subject: 'Last one from me for a while',
    body: `Hi {firstName},

I've been sending you value for a few months now. I'll leave you alone after this.

If the timing was off, I get it. Decisions like this need to land at the right moment.

If that moment comes, you know where to find me.

The $500 audit offer stands whenever you're ready. No pressure, no expiry.

Mike
Go Automated`,
  },
]);

db.close();
