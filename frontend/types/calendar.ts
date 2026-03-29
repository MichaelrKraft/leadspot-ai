export type EventType = 'call' | 'meeting' | 'follow-up' | 'deadline';

export type EventStatus = 'scheduled' | 'completed' | 'cancelled';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: EventType;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  status: EventStatus;
}

export interface Availability {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export const EVENT_TYPE_COLORS: Record<EventType, { bg: string; text: string; dot: string }> = {
  call: { bg: 'bg-blue-500/20', text: 'text-blue-500', dot: 'bg-blue-500' },
  meeting: { bg: 'bg-green-500/20', text: 'text-green-500', dot: 'bg-green-500' },
  'follow-up': { bg: 'bg-orange-500/20', text: 'text-orange-500', dot: 'bg-orange-500' },
  deadline: { bg: 'bg-red-500/20', text: 'text-red-500', dot: 'bg-red-500' },
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  call: 'Call',
  meeting: 'Meeting',
  'follow-up': 'Follow-up',
  deadline: 'Deadline',
};
