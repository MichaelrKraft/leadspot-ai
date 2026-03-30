export interface QualificationStep {
  id: string;
  question: string;
  answerType: 'free_text' | 'multiple_choice' | 'yes_no' | 'number_range';
  options?: string[];
  required: boolean;
  skipCondition?: { stepId: string; value: string };
  scoreWeight: number;
}

export interface PostCallRule {
  id: string;
  condition: {
    type: 'score_range' | 'answer_value' | 'appointment_status';
    field?: string;
    operator: string;
    value: string;
  };
  action: {
    type:
      | 'add_tag'
      | 'enroll_action_plan'
      | 'add_to_smart_list'
      | 'send_sms'
      | 'update_score';
    target: string;
    label: string;
  };
}

export interface VoiceAgentConfig {
  name: string;
  voice: string;
  personality: string;
  openingScript: string;
  tone: 'professional' | 'friendly' | 'casual' | 'authoritative';
  allowInterruption: boolean;
  qualificationSteps: QualificationStep[];
  duringCallActions: {
    saveContact: boolean;
    bookAppointment: boolean;
    sendPropertyLink: boolean;
    transferToAgent: boolean;
  };
  postCallRules: PostCallRule[];
  propertyContext: {
    address: string;
    price: string;
    beds: string;
    baths: string;
    description: string;
  };
  companyInfo: {
    name: string;
    agentName: string;
    phone: string;
    website: string;
  };
  complianceNotes: string;
  faqResponses: { question: string; answer: string }[];
  customVariables: { key: string; value: string }[];
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  style: string;
}

export const VOICES: VoiceOption[] = [
  { id: 'rachel', name: 'Rachel', gender: 'female', style: 'Professional' },
  { id: 'james', name: 'James', gender: 'male', style: 'Friendly' },
  { id: 'emily', name: 'Emily', gender: 'female', style: 'Warm' },
  { id: 'david', name: 'David', gender: 'male', style: 'Authoritative' },
  { id: 'sofia', name: 'Sofia', gender: 'female', style: 'Energetic' },
  { id: 'marcus', name: 'Marcus', gender: 'male', style: 'Calm' },
  { id: 'aria', name: 'Aria', gender: 'female', style: 'Natural' },
  { id: 'ethan', name: 'Ethan', gender: 'male', style: 'Conversational' },
];

function makeId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const BUYER_QUALIFIER_STEPS: QualificationStep[] = [
  {
    id: 'bq-1',
    question: 'Are you looking to buy or sell a property?',
    answerType: 'multiple_choice',
    options: ['Buy', 'Sell', 'Both', 'Just browsing'],
    required: true,
    scoreWeight: 8,
  },
  {
    id: 'bq-2',
    question: 'What type of property are you interested in?',
    answerType: 'multiple_choice',
    options: [
      'Single Family Home',
      'Condo / Townhouse',
      'Multi-Family',
      'Land / Lot',
      'Commercial',
    ],
    required: true,
    scoreWeight: 6,
  },
  {
    id: 'bq-3',
    question: 'What area or neighborhood are you looking in?',
    answerType: 'free_text',
    required: true,
    scoreWeight: 5,
  },
  {
    id: 'bq-4',
    question: 'What is your budget range?',
    answerType: 'multiple_choice',
    options: [
      'Under $200K',
      '$200K - $400K',
      '$400K - $600K',
      '$600K - $1M',
      'Over $1M',
    ],
    required: true,
    scoreWeight: 9,
  },
  {
    id: 'bq-5',
    question: 'What is your timeline for purchasing?',
    answerType: 'multiple_choice',
    options: [
      'Immediately',
      'Within 1-3 months',
      '3-6 months',
      '6-12 months',
      'Just exploring',
    ],
    required: true,
    scoreWeight: 7,
  },
  {
    id: 'bq-6',
    question: 'Have you been pre-approved for a mortgage?',
    answerType: 'yes_no',
    required: true,
    scoreWeight: 10,
  },
  {
    id: 'bq-7',
    question: 'Are you currently working with a real estate agent?',
    answerType: 'yes_no',
    required: true,
    scoreWeight: 8,
  },
];

const BUYER_QUALIFIER_RULES: PostCallRule[] = [
  {
    id: 'bqr-1',
    condition: {
      type: 'score_range',
      operator: '>=',
      value: '35',
    },
    action: {
      type: 'add_tag',
      target: 'hot-lead',
      label: 'Tag as Hot Lead',
    },
  },
  {
    id: 'bqr-2',
    condition: {
      type: 'score_range',
      operator: '>=',
      value: '20',
    },
    action: {
      type: 'enroll_action_plan',
      target: 'buyer-nurture',
      label: 'Enroll in Buyer Nurture Plan',
    },
  },
  {
    id: 'bqr-3',
    condition: {
      type: 'answer_value',
      field: 'bq-7',
      operator: '==',
      value: 'Yes',
    },
    action: {
      type: 'add_tag',
      target: 'has-agent',
      label: 'Tag: Has Agent',
    },
  },
];

const LISTING_CALLER_STEPS: QualificationStep[] = [
  {
    id: 'lc-1',
    question: 'What is the address of the property you are considering selling?',
    answerType: 'free_text',
    required: true,
    scoreWeight: 6,
  },
  {
    id: 'lc-2',
    question: 'What is your primary reason for selling?',
    answerType: 'multiple_choice',
    options: [
      'Upgrading',
      'Downsizing',
      'Relocating',
      'Financial reasons',
      'Investment',
      'Other',
    ],
    required: true,
    scoreWeight: 5,
  },
  {
    id: 'lc-3',
    question: 'What is your desired timeline to sell?',
    answerType: 'multiple_choice',
    options: [
      'ASAP',
      'Within 1-3 months',
      '3-6 months',
      '6-12 months',
      'No rush',
    ],
    required: true,
    scoreWeight: 8,
  },
  {
    id: 'lc-4',
    question: 'Do you have a price expectation or have you had an appraisal done?',
    answerType: 'free_text',
    required: false,
    scoreWeight: 7,
  },
  {
    id: 'lc-5',
    question: 'Are you currently working with a listing agent?',
    answerType: 'yes_no',
    required: true,
    scoreWeight: 9,
  },
];

const LISTING_CALLER_RULES: PostCallRule[] = [
  {
    id: 'lcr-1',
    condition: {
      type: 'score_range',
      operator: '>=',
      value: '25',
    },
    action: {
      type: 'add_tag',
      target: 'hot-seller',
      label: 'Tag as Hot Seller',
    },
  },
  {
    id: 'lcr-2',
    condition: {
      type: 'appointment_status',
      operator: '==',
      value: 'booked',
    },
    action: {
      type: 'enroll_action_plan',
      target: 'listing-appointment-prep',
      label: 'Enroll in Listing Appointment Prep',
    },
  },
  {
    id: 'lcr-3',
    condition: {
      type: 'answer_value',
      field: 'lc-5',
      operator: '==',
      value: 'No',
    },
    action: {
      type: 'add_to_smart_list',
      target: 'unrepresented-sellers',
      label: 'Add to Unrepresented Sellers List',
    },
  },
];

const FOLLOWUP_STEPS: QualificationStep[] = [
  {
    id: 'fu-1',
    question:
      'I wanted to follow up on our previous conversation. Are you still interested in real estate?',
    answerType: 'yes_no',
    required: true,
    scoreWeight: 7,
  },
  {
    id: 'fu-2',
    question: 'Has anything changed in your timeline or requirements?',
    answerType: 'free_text',
    required: false,
    scoreWeight: 5,
  },
  {
    id: 'fu-3',
    question:
      'Would you like to schedule a time to discuss your options with an agent?',
    answerType: 'yes_no',
    required: true,
    scoreWeight: 9,
  },
];

const FOLLOWUP_RULES: PostCallRule[] = [
  {
    id: 'fur-1',
    condition: {
      type: 'answer_value',
      field: 'fu-1',
      operator: '==',
      value: 'Yes',
    },
    action: {
      type: 'add_tag',
      target: 're-engaged',
      label: 'Tag as Re-engaged',
    },
  },
  {
    id: 'fur-2',
    condition: {
      type: 'appointment_status',
      operator: '==',
      value: 'booked',
    },
    action: {
      type: 'enroll_action_plan',
      target: 'appointment-confirmation',
      label: 'Enroll in Appointment Confirmation',
    },
  },
  {
    id: 'fur-3',
    condition: {
      type: 'answer_value',
      field: 'fu-1',
      operator: '==',
      value: 'No',
    },
    action: {
      type: 'add_to_smart_list',
      target: 'long-term-nurture',
      label: 'Add to Long-term Nurture',
    },
  },
];

export const DEFAULT_CONFIG: VoiceAgentConfig = {
  name: '',
  voice: 'rachel',
  personality:
    'You are a professional, helpful real estate assistant. Be polite, concise, and focus on qualifying the lead.',
  openingScript:
    'Hi {{contact_name}}, this is {{agent_name}} calling from {{company_name}}. How are you today?',
  tone: 'professional',
  allowInterruption: true,
  qualificationSteps: [],
  duringCallActions: {
    saveContact: true,
    bookAppointment: false,
    sendPropertyLink: false,
    transferToAgent: false,
  },
  postCallRules: [],
  propertyContext: {
    address: '',
    price: '',
    beds: '',
    baths: '',
    description: '',
  },
  companyInfo: {
    name: '',
    agentName: '',
    phone: '',
    website: '',
  },
  complianceNotes: '',
  faqResponses: [],
  customVariables: [],
};

export const TEMPLATES: Record<string, VoiceAgentConfig> = {
  'buyer-qualifier': {
    ...DEFAULT_CONFIG,
    name: 'Buyer Qualifier',
    voice: 'rachel',
    personality:
      'You are a professional real estate assistant specializing in buyer qualification. Ask questions naturally and conversationally. If the lead seems uninterested, politely wrap up. Always be respectful of their time.',
    openingScript:
      'Hi {{contact_name}}, this is {{agent_name}} with {{company_name}}. I noticed you were looking at properties in the area and wanted to see if I could help you find the right home. Do you have a quick minute?',
    tone: 'professional',
    allowInterruption: true,
    qualificationSteps: BUYER_QUALIFIER_STEPS,
    duringCallActions: {
      saveContact: true,
      bookAppointment: true,
      sendPropertyLink: true,
      transferToAgent: true,
    },
    postCallRules: BUYER_QUALIFIER_RULES,
  },
  'listing-caller': {
    ...DEFAULT_CONFIG,
    name: 'Listing Caller',
    voice: 'david',
    personality:
      'You are an authoritative but approachable real estate assistant focused on listing appointments. You understand the selling process well and can discuss market conditions. Be confident and knowledgeable.',
    openingScript:
      'Hello {{contact_name}}, this is {{agent_name}} from {{company_name}}. I specialize in helping homeowners in your area get the best value for their property. I was wondering if you had considered selling or would like a free market analysis?',
    tone: 'authoritative',
    allowInterruption: true,
    qualificationSteps: LISTING_CALLER_STEPS,
    duringCallActions: {
      saveContact: true,
      bookAppointment: true,
      sendPropertyLink: false,
      transferToAgent: true,
    },
    postCallRules: LISTING_CALLER_RULES,
  },
  'follow-up-agent': {
    ...DEFAULT_CONFIG,
    name: 'Follow-up Agent',
    voice: 'emily',
    personality:
      'You are a warm, friendly real estate assistant making a follow-up call. Be casual but professional. The goal is to re-engage the contact and see if their needs have changed. Do not be pushy.',
    openingScript:
      "Hi {{contact_name}}, this is {{agent_name}} from {{company_name}}. We spoke a while back about your real estate plans and I just wanted to check in. How have you been?",
    tone: 'friendly',
    allowInterruption: true,
    qualificationSteps: FOLLOWUP_STEPS,
    duringCallActions: {
      saveContact: true,
      bookAppointment: true,
      sendPropertyLink: false,
      transferToAgent: false,
    },
    postCallRules: FOLLOWUP_RULES,
  },
};

export { makeId, makeRuleId };
