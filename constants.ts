import { Transaction, TransactionType } from './types';

export const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Health & Fitness',
  'Housing',
  'Income',
  'Other'
];

export const COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // green-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#6366f1', // indigo-500
  '#64748b', // slate-500
];

export const SAMPLE_DATA: Transaction[] = [
  { id: '1', date: '2023-10-01', description: 'Gaji Bulanan', amount: 8000000, category: 'Income', type: TransactionType.INCOME },
  { id: '2', date: '2023-10-02', description: 'Belanja Mingguan', amount: 500000, category: 'Food & Dining', type: TransactionType.EXPENSE },
  { id: '3', date: '2023-10-03', description: 'Gojek/Grab', amount: 35000, category: 'Transportation', type: TransactionType.EXPENSE },
  { id: '4', date: '2023-10-05', description: 'Netflix', amount: 186000, category: 'Entertainment', type: TransactionType.EXPENSE },
  { id: '5', date: '2023-10-05', description: 'Token Listrik', amount: 200000, category: 'Utilities', type: TransactionType.EXPENSE },
  { id: '6', date: '2023-10-10', description: 'Tokopedia', amount: 150000, category: 'Shopping', type: TransactionType.EXPENSE },
  { id: '7', date: '2023-10-12', description: 'Gym Membership', amount: 350000, category: 'Health & Fitness', type: TransactionType.EXPENSE },
  { id: '8', date: '2023-10-15', description: 'Bensin Pertamina', amount: 50000, category: 'Transportation', type: TransactionType.EXPENSE },
  { id: '9', date: '2023-10-18', description: 'Kopi Kenangan', amount: 25000, category: 'Food & Dining', type: TransactionType.EXPENSE },
  { id: '10', date: '2023-10-20', description: 'Bayar Kost', amount: 2000000, category: 'Housing', type: TransactionType.EXPENSE },
  { id: '11', date: '2023-10-25', description: 'Proyek Freelance', amount: 1500000, category: 'Income', type: TransactionType.INCOME },
  { id: '12', date: '2023-10-28', description: 'Indomaret', amount: 45000, category: 'Shopping', type: TransactionType.EXPENSE },
];