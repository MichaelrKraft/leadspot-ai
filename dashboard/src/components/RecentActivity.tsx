'use client';

interface Activity {
  id: string;
  type: 'email' | 'sms' | 'form' | 'campaign';
  message: string;
  time: string;
}

const mockActivities: Activity[] = [
  { id: '1', type: 'email', message: 'Welcome email sent to 45 new contacts', time: '2 min ago' },
  { id: '2', type: 'form', message: 'New lead captured from Landing Page A', time: '15 min ago' },
  { id: '3', type: 'campaign', message: 'Black Friday campaign triggered', time: '1 hour ago' },
  { id: '4', type: 'sms', message: 'Appointment reminder sent to John Doe', time: '2 hours ago' },
  { id: '5', type: 'email', message: 'Newsletter delivered to 1,234 subscribers', time: '3 hours ago' },
];

const typeColors = {
  email: 'bg-accent-cyan/20 text-accent-cyan',
  sms: 'bg-accent-purple/20 text-accent-purple',
  form: 'bg-accent-green/20 text-accent-green',
  campaign: 'bg-accent-yellow/20 text-accent-yellow',
};

const typeIcons = {
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  sms: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  form: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  campaign: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
};

export default function RecentActivity() {
  return (
    <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {mockActivities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColors[activity.type]}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d={typeIcons[activity.type]}
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary">{activity.message}</p>
              <p className="text-xs text-text-muted mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 py-2 text-sm text-accent-cyan hover:text-accent-cyan/80 transition-colors">
        View all activity
      </button>
    </div>
  );
}
