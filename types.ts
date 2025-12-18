export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  image?: string; // Base64 string of the receipt
}

export interface SpendingSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categoryBreakdown: { name: string; value: number; color: string }[];
  monthlyTrend: { name: string; income: number; expense: number }[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}