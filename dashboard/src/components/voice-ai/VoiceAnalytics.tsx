'use client';

interface VoiceAgent {
  id: string;
  status: string;
}

interface VoiceCall {
  id: string;
  duration?: number;
  outcome?: string;
}

interface Props {
  agents: VoiceAgent[];
  calls: VoiceCall[];
}

export function VoiceAnalytics({ agents, calls }: Props) {
  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const totalCalls = calls.length;
  const qualifiedLeads = calls.filter((c) => c.outcome === 'qualified').length;
  const appointmentsBooked = calls.filter((c) => c.outcome === 'appointment_booked').length;
  const avgDuration = calls.length > 0
    ? Math.round(calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length)
    : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stats = [
    {
      label: 'Active Agents',
      value: activeAgents.toString(),
      icon: '🤖',
      color: 'bg-mautic-blue',
      bgColor: 'bg-mautic-blue/10',
    },
    { 
      label: 'Total Calls', 
      value: totalCalls.toString(), 
      icon: '📞', 
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
    },
    { 
      label: 'Qualified Leads', 
      value: qualifiedLeads.toString(), 
      icon: '✓', 
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
    },
    { 
      label: 'Appointments', 
      value: appointmentsBooked.toString(), 
      icon: '📅', 
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
    },
    { 
      label: 'Avg Duration', 
      value: formatDuration(avgDuration), 
      icon: '⏱️', 
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div 
          key={stat.label} 
          className={`${stat.bgColor} rounded-xl p-4 border border-gray-100`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white text-lg`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-gray-500 text-xs">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
