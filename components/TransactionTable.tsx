import React, { useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { ArrowUpCircle, ArrowDownCircle, Search, Trash2 } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = transactions.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="font-semibold text-gray-800">Recent Transactions</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-auto flex-grow">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length > 0 ? filtered.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">{t.date}</td>
                <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                  <div className="flex items-center gap-2">
                    {t.type === TransactionType.INCOME ? (
                      <ArrowUpCircle size={16} className="text-green-500" />
                    ) : (
                      <ArrowDownCircle size={16} className="text-red-500" />
                    )}
                    {t.description}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {t.category}
                  </span>
                </td>
                <td className={`py-3 px-4 text-sm font-semibold text-right ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-gray-900'}`}>
                  {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                </td>
                <td className="py-3 px-4 text-center">
                  <button 
                    onClick={() => onDelete(t.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete transaction"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">No transactions found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionTable;