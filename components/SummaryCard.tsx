import React from 'react';
import { ArrowUp, ArrowDown, DollarSign, Wallet } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  amount: number;
  type?: 'neutral' | 'positive' | 'negative';
  icon?: React.ReactNode;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, amount, type = 'neutral', icon }) => {
  let colorClass = 'text-gray-900';
  
  if (type === 'positive') colorClass = 'text-green-600';
  if (type === 'negative') colorClass = 'text-red-600';

  const formattedAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
        <div className={`p-2 rounded-lg ${type === 'positive' ? 'bg-green-50' : type === 'negative' ? 'bg-red-50' : 'bg-gray-50'}`}>
          {icon || <Wallet size={20} className={colorClass} />}
        </div>
      </div>
      <div>
        <span className={`text-2xl font-bold ${colorClass}`}>
          {formattedAmount}
        </span>
      </div>
    </div>
  );
};

export default SummaryCard;