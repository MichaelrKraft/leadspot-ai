export interface CommunityPost {
  id: string;
  authorName: string;
  authorAvatar?: string;
  authorRole: string;
  type: 'discussion' | 'question' | 'tip' | 'win';
  title: string;
  content: string;
  tags: string[];
  reactions: { type: string; count: number; reacted: boolean }[];
  commentCount: number;
  createdAt: string;
  isPinned?: boolean;
}

export interface CommunityComment {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  reactions: { type: string; count: number; reacted: boolean }[];
  replies?: CommunityComment[];
}

export const COMMUNITY_INFO = {
  name: 'LeadSpot Community',
  description:
    'Share strategies, tips, and wins with fellow real estate professionals.',
  memberCount: 142,
  postCount: 38,
  onlineCount: 12,
};

export const POPULAR_TAGS = [
  'lead-gen',
  'follow-up',
  'smart-lists',
  'action-plans',
  'automation',
  'closing',
  'nurture',
  'pipeline',
];

export const TOP_CONTRIBUTORS = [
  { name: 'Rachel Kim', points: 312, role: 'Top Contributor' },
  { name: 'Marcus Johnson', points: 248, role: 'Power User' },
  { name: 'Sarah Chen', points: 195, role: 'Helpful Member' },
  { name: 'David Park', points: 167, role: 'Active Member' },
];

export const DEMO_POSTS: CommunityPost[] = [
  {
    id: 'post-1',
    authorName: 'LeadSpot Team',
    authorRole: 'Admin',
    type: 'discussion',
    title: 'Welcome to the LeadSpot Community!',
    content:
      'Welcome to the official LeadSpot Community! This is your space to connect with fellow real estate professionals, share strategies that are working for you, ask questions, and celebrate your wins.\n\nA few guidelines to keep this space valuable for everyone:\n- Be respectful and constructive\n- Share specific results when possible (numbers help everyone learn)\n- Use tags to help others find your posts\n- Search before asking -- your question may already be answered\n\nWe are excited to have you here. Introduce yourself in the comments below!',
    tags: ['welcome', 'guidelines', 'community'],
    reactions: [
      { type: 'like', count: 47, reacted: false },
      { type: 'love', count: 23, reacted: false },
      { type: 'celebrate', count: 18, reacted: false },
      { type: 'insightful', count: 5, reacted: false },
    ],
    commentCount: 12,
    createdAt: '2026-03-15T09:00:00Z',
    isPinned: true,
  },
  {
    id: 'post-2',
    authorName: 'Rachel Kim',
    authorRole: 'Broker',
    type: 'win',
    title: 'Just closed my first deal using Smart Lists!',
    content:
      'I have been using LeadSpot for about 6 weeks now and just closed my first deal that came directly from a Smart List follow-up sequence. The lead was tagged as "warm" for 3 weeks and the automated drip kept them engaged until they were ready to schedule a showing.\n\nThe deal was a $425K single-family home. My commission covered my LeadSpot subscription for the next 3 years. If you are on the fence about setting up Smart Lists, just do it. The 30 minutes of setup time paid off massively.\n\nHappy to share my exact Smart List filters if anyone wants them!',
    tags: ['smart-lists', 'closing', 'success-story'],
    reactions: [
      { type: 'like', count: 34, reacted: false },
      { type: 'love', count: 19, reacted: false },
      { type: 'celebrate', count: 42, reacted: false },
      { type: 'insightful', count: 11, reacted: false },
    ],
    commentCount: 8,
    createdAt: '2026-03-28T14:30:00Z',
  },
  {
    id: 'post-3',
    authorName: 'Marcus Johnson',
    authorRole: 'Team Lead',
    type: 'question',
    title: 'How do you handle lead routing for teams of 5+?',
    content:
      'Our team just grew to 6 agents and I am trying to figure out the best way to route incoming leads. Right now I am manually assigning them based on zip code, but it is becoming a bottleneck.\n\nDoes anyone have a good system for automatic lead routing? Ideally I would like to route based on:\n- Geographic area\n- Agent availability\n- Lead source (some agents are better with referrals vs cold leads)\n\nAny tips or workflows you have set up would be super helpful.',
    tags: ['lead-routing', 'teams', 'automation'],
    reactions: [
      { type: 'like', count: 15, reacted: false },
      { type: 'love', count: 2, reacted: false },
      { type: 'celebrate', count: 0, reacted: false },
      { type: 'insightful', count: 8, reacted: false },
    ],
    commentCount: 6,
    createdAt: '2026-03-27T10:15:00Z',
  },
  {
    id: 'post-4',
    authorName: 'Sarah Chen',
    authorRole: 'Solo Agent',
    type: 'tip',
    title:
      'Tip: Set up auto-pause on Action Plans so you do not spam warm leads',
    content:
      'Quick tip that saved me from losing a lead last week. If you are running Action Plans with email sequences, make sure to enable the auto-pause feature when a lead replies.\n\nWithout it, the sequence keeps firing even after the lead responds. I had a prospect reply saying they wanted to schedule a call, but then got two more automated emails after that. Not a great look.\n\nTo set it up:\n1. Go to Action Plans > Edit Plan\n2. Under "Engagement Rules" toggle on "Pause on Reply"\n3. Optionally set "Pause on Click" if you want to be extra careful\n\nThis one small change made my sequences feel way more personal.',
    tags: ['action-plans', 'automation', 'email', 'tip'],
    reactions: [
      { type: 'like', count: 28, reacted: false },
      { type: 'love', count: 7, reacted: false },
      { type: 'celebrate', count: 3, reacted: false },
      { type: 'insightful', count: 31, reacted: false },
    ],
    commentCount: 4,
    createdAt: '2026-03-26T16:45:00Z',
  },
  {
    id: 'post-5',
    authorName: 'David Park',
    authorRole: 'Agent',
    type: 'discussion',
    title: 'Speed-to-lead tracking changed my conversion rate',
    content:
      'I started paying attention to the speed-to-lead metric in my dashboard about a month ago and it has been eye-opening. My average response time was 4.2 hours. After seeing that, I set up push notifications and got it down to 18 minutes.\n\nResult: my lead-to-appointment rate went from 8% to 22% in 30 days. The data is clear -- responding within 5 minutes gives you the best shot.\n\nAnyone else tracking this? What is your response time looking like?',
    tags: ['speed-to-lead', 'conversion', 'metrics'],
    reactions: [
      { type: 'like', count: 41, reacted: false },
      { type: 'love', count: 12, reacted: false },
      { type: 'celebrate', count: 8, reacted: false },
      { type: 'insightful', count: 27, reacted: false },
    ],
    commentCount: 11,
    createdAt: '2026-03-25T08:20:00Z',
  },
  {
    id: 'post-6',
    authorName: 'Tanya Brooks',
    authorRole: 'Agent',
    type: 'question',
    title: 'Anyone using the voice commands feature?',
    content:
      'I saw in the last update notes that LeadSpot added voice commands for logging activities. Has anyone actually tried it? I spend a lot of time driving between showings and being able to log notes hands-free would be a game changer.\n\nSpecifically wondering:\n- How accurate is the transcription?\n- Can it create tasks or just notes?\n- Does it work with Bluetooth car systems?\n\nWould love to hear from anyone who has tested it out.',
    tags: ['voice-commands', 'mobile', 'productivity'],
    reactions: [
      { type: 'like', count: 9, reacted: false },
      { type: 'love', count: 3, reacted: false },
      { type: 'celebrate', count: 0, reacted: false },
      { type: 'insightful', count: 4, reacted: false },
    ],
    commentCount: 3,
    createdAt: '2026-03-24T11:00:00Z',
  },
  {
    id: 'post-7',
    authorName: 'Jason Rivera',
    authorRole: 'Broker',
    type: 'win',
    title: 'My pipeline brief caught a deal I almost forgot about',
    content:
      'Shoutout to the daily Pipeline Brief feature. This morning it flagged a lead I had not contacted in 12 days -- a buyer who was pre-approved but went quiet after their first showing.\n\nI called them, turns out they had just been busy with work and were still very interested. We are now under contract on a $380K townhome. Without that reminder, this deal would have slipped through the cracks entirely.\n\nIf you are not reading your Pipeline Brief every morning, you are leaving money on the table.',
    tags: ['pipeline-brief', 'follow-up', 'closing'],
    reactions: [
      { type: 'like', count: 36, reacted: false },
      { type: 'love', count: 15, reacted: false },
      { type: 'celebrate', count: 29, reacted: false },
      { type: 'insightful', count: 14, reacted: false },
    ],
    commentCount: 7,
    createdAt: '2026-03-23T07:45:00Z',
  },
  {
    id: 'post-8',
    authorName: 'Lisa Nguyen',
    authorRole: 'Team Lead',
    type: 'discussion',
    title: 'Best practices for nurture sequences?',
    content:
      'I am revamping my nurture sequences and would love to hear what is working for others. Currently I have a 90-day drip for cold leads but the open rates drop off a cliff after email 4.\n\nA few things I am considering:\n- Mixing in SMS touchpoints between emails\n- Adding value-based content (market reports, neighborhood guides) instead of just "checking in"\n- Shortening the sequence to 60 days but increasing frequency\n\nWhat does your nurture sequence look like? How many touchpoints and over what timeframe?',
    tags: ['nurture', 'email', 'sms', 'sequences'],
    reactions: [
      { type: 'like', count: 22, reacted: false },
      { type: 'love', count: 5, reacted: false },
      { type: 'celebrate', count: 1, reacted: false },
      { type: 'insightful', count: 18, reacted: false },
    ],
    commentCount: 9,
    createdAt: '2026-03-22T13:30:00Z',
  },
];

export const DEMO_COMMENTS: Record<string, CommunityComment[]> = {
  'post-1': [
    {
      id: 'comment-1',
      authorName: 'Rachel Kim',
      authorRole: 'Broker',
      content:
        'Excited to be here! I have been using LeadSpot for about a month and already seeing great results. Looking forward to learning from everyone.',
      createdAt: '2026-03-15T10:30:00Z',
      reactions: [
        { type: 'like', count: 8, reacted: false },
        { type: 'love', count: 3, reacted: false },
      ],
      replies: [
        {
          id: 'comment-1-reply-1',
          authorName: 'LeadSpot Team',
          authorRole: 'Admin',
          content:
            'Welcome Rachel! Great to have you. Feel free to share any wins or questions as you go.',
          createdAt: '2026-03-15T11:00:00Z',
          reactions: [{ type: 'like', count: 2, reacted: false }],
        },
      ],
    },
    {
      id: 'comment-2',
      authorName: 'Marcus Johnson',
      authorRole: 'Team Lead',
      content:
        'Great community idea. My team and I have been looking for a place to share workflows with other agents. Quick question -- is there a way to share Action Plan templates directly through the community?',
      createdAt: '2026-03-15T14:20:00Z',
      reactions: [
        { type: 'like', count: 5, reacted: false },
        { type: 'insightful', count: 2, reacted: false },
      ],
      replies: [
        {
          id: 'comment-2-reply-1',
          authorName: 'LeadSpot Team',
          authorRole: 'Admin',
          content:
            'Not yet, but template sharing is on our roadmap for Q2. For now, you can share screenshots or describe your setup and others can recreate it.',
          createdAt: '2026-03-15T15:00:00Z',
          reactions: [
            { type: 'like', count: 4, reacted: false },
            { type: 'insightful', count: 3, reacted: false },
          ],
        },
      ],
    },
    {
      id: 'comment-3',
      authorName: 'David Park',
      authorRole: 'Agent',
      content:
        'Love this. Been a solo agent for 5 years and having a community to bounce ideas off is exactly what I needed. Thanks for building this!',
      createdAt: '2026-03-16T09:15:00Z',
      reactions: [
        { type: 'like', count: 11, reacted: false },
        { type: 'love', count: 6, reacted: false },
      ],
    },
    {
      id: 'comment-4',
      authorName: 'Tanya Brooks',
      authorRole: 'Agent',
      content:
        'Just joined last week. Already found some great tips in the posts here. The auto-pause tip for Action Plans saved me from a potential embarrassment with a client.',
      createdAt: '2026-03-20T16:45:00Z',
      reactions: [
        { type: 'like', count: 7, reacted: false },
        { type: 'celebrate', count: 2, reacted: false },
      ],
    },
    {
      id: 'comment-5',
      authorName: 'Jason Rivera',
      authorRole: 'Broker',
      content:
        'Is there a way to get email notifications when someone posts in a specific tag? I want to follow the "closing" and "pipeline-brief" tags without checking in every day.',
      createdAt: '2026-03-22T08:30:00Z',
      reactions: [
        { type: 'like', count: 3, reacted: false },
        { type: 'insightful', count: 1, reacted: false },
      ],
    },
  ],
};
