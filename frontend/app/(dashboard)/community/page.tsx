'use client';

export default function CommunityPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Community</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Connect with other LeadSpot users, share strategies, and get help.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-20 dark:border-zinc-800/50 dark:bg-zinc-900">
        <svg
          className="mb-4 h-12 w-12 text-slate-300 dark:text-zinc-600"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
        <h2 className="mb-2 text-lg font-semibold text-slate-700 dark:text-zinc-300">
          Community Features Coming Soon
        </h2>
        <p className="mb-6 max-w-md text-center text-sm text-slate-400 dark:text-zinc-500">
          We are building a space for LeadSpot users to share campaign strategies, automation templates, and best practices. Stay tuned!
        </p>
        <div className="flex gap-3">
          <a
            href="https://discord.gg/leadspot"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
          >
            Join Discord
          </a>
          <a
            href="https://twitter.com/leadspot_ai"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Follow on X
          </a>
        </div>
      </div>
    </div>
  );
}
