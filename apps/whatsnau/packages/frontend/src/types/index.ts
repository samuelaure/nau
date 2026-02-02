export interface Metric {
  totalContacts: number;
  delivered: number;
  read: number;
  replied: number;
  interested: number;
  conversions: number;
  blocked: number;
  conversionRate: number;
}

export interface CampaignStats {
  campaignId: string;
  name: string;
  metrics: Metric;
}

export interface Lead {
  id: string;
  phoneNumber: string;
  name: string | null;
  status: string;
  aiEnabled: boolean;
  state: string;
  lastInteraction: string;
  tags: { name: string }[];
  currentStage: { name: string } | null;
}

export interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  timestamp: string;
  status: string;
}

export interface Opportunity {
  id: string;
  type: string;
  description: string;
  severity: string;
  aiGenerated: boolean;
}

export interface StagingLead {
  id: string;
  phoneNumber: string;
  name: string | null;
  cleanseStatus: string;
  isValidWhatsApp: boolean;
  isVerified: boolean;
  opportunities: Opportunity[];
}

export interface ImportBatch {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  stagingLeads: StagingLead[];
  _count?: {
    stagingLeads: number;
  };
}

export interface Template {
  name: string;
  status: string;
  category: string;
  language: string;
  components: { type: string; text?: string }[];
}

export interface BusinessConfig {
  name: string;
  knowledgeBase: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  isEnabled: boolean;
}

export interface PromptConfig {
  role: string;
  basePrompt: string;
}

export interface SequenceConfig {
  id: string;
  name: string;
  waitHours: number;
  order: number;
}

export interface KeywordConfig {
  id: string;
  word: string;
  type: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LogEntry {
  level: number;
  time: number;
  msg: string;
  pid?: number;
  hostname?: string;
  [key: string]: any;
}
