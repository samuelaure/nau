export interface Message {
  id: string;
  userId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
}

export interface UserWithFeatures {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  displayName: string | null;
  onboardingState: string;
  features: string[];
  messages: Message[];
  createdAt: Date | string;
}
