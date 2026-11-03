export interface Reminder {
  id: string;
  Name: string;
  'Next Payment': string; // YYYY-MM-DD
  Time?: string; // HH:MM, optional
  Category: string;
  Active: 'Yes' | 'No';
  Notes?: string;
  remindBefore?: number;
  Repeat?: 'One-Time' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  tamilMonthIndex?: number; // 0-11
  tamilDay?: number; // 1-32
  HolidayType?: string; // e.g., "Diwali", "Pongal"
  Source?: 'API' | 'AI' | 'Manual';
}

export interface DashboardData {
  reminders: Reminder[];
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  description: string;
}

export interface Settings {
  geminiApiKey?: string;
  geminiModel?: string;
  calendarificApiKey?: string;
  gotifyUrl: string;
  gotifyToken: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  testRecipient: string;
  notificationsEnabled: boolean;
  dailyCheckTime: string;
  lastDailyCheck: string | null;
}

export interface PulseSummary {
  status: string;
  service: string;
  timestamp: string;
  counts: {
    total: number;
    active: number;
    overdue: number;
    dueToday: number;
    dueTomorrow: number;
    upcomingWithinWindow: number;
    windowDays: number;
  };
  nextUpcoming?: {
    id: string;
    name: string;
    dueDate: string;
    time: string;
    category: string;
    repeat: string;
    daysRemaining: number;
    isOverdue: boolean;
    isToday: boolean;
  };
  dueToday: Array<{
    id: string;
    name: string;
    dueDate: string;
    time: string;
    category: string;
    repeat: string;
    daysRemaining: number;
  }>;
  dueTomorrow: Array<{
    id: string;
    name: string;
    dueDate: string;
    time: string;
    category: string;
    repeat: string;
    daysRemaining: number;
  }>;
  overdue: Array<{
    id: string;
    name: string;
    dueDate: string;
    time: string;
    category: string;
    repeat: string;
    daysRemaining: number;
  }>;
  upcoming: Array<{
    id: string;
    name: string;
    dueDate: string;
    time: string;
    category: string;
    repeat: string;
    daysRemaining: number;
  }>;
}
