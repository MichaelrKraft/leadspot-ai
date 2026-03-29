'use client';

interface VoiceCall {
  id: string;
  direction: string;
  status: string;
  phoneNumber: string;
  duration?: number;
  outcome?: string;
  startedAt: string;
  agent: { 
    id: string;
    name: string;
    type: string;
  };
  transcript?: { id: string } | null;
}

interface Props {
  calls: VoiceCall[];
}

const outcomeLabels: Record<string, string> = {
  qualified: 'Qualified',
  appointment_booked: 'Appointment Booked',
  callback_requested: 'Callback Requested',
  not_interested: 'Not Interested',
};

const outcomeColors: Record<string, string> = {
  qualified: 'bg-green-100 text-green-800',
  appointment_booked: 'bg-blue-100 text-blue-800',
  callback_requested: 'bg-yellow-100 text-yellow-800',
  not_interested: 'bg-gray-100 text-gray-600',
};

export function CallLogTable({ calls }: Props) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
        <a
          href="/voice-ai/calls"
          className="text-sm text-mautic-blue hover:text-mautic-blue-dark"
        >
          View All →
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Agent</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-left">Outcome</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {calls.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="text-3xl mb-2">📞</div>
                  <p className="text-gray-500">No calls yet</p>
                </td>
              </tr>
            ) : (
              calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span 
                        className={`text-lg ${
                          call.direction === 'inbound' 
                            ? 'text-green-500' 
                            : 'text-blue-500'
                        }`}
                        title={call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                      >
                        {call.direction === 'inbound' ? '↓' : '↑'}
                      </span>
                      <span className="font-mono text-sm">{call.phoneNumber}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {call.agent.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {formatDuration(call.duration)}
                  </td>
                  <td className="px-4 py-3">
                    {call.outcome ? (
                      <span 
                        className={`px-2 py-1 text-xs rounded-full font-medium ${
                          outcomeColors[call.outcome] || 'bg-gray-100'
                        }`}
                      >
                        {outcomeLabels[call.outcome] || call.outcome}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">
                        {call.status === 'in_progress' ? 'In progress...' : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {formatTime(call.startedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {call.transcript && (
                      <a
                        href={`/voice-ai/calls/${call.id}`}
                        className="text-xs text-mautic-blue hover:text-mautic-blue-dark"
                      >
                        View
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
