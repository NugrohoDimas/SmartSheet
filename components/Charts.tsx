import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { COLORS } from '../constants';

interface CategoryData {
  name: string;
  value: number;
  color: string;
  [key: string]: any;
}

interface MonthlyData {
  name: string;
  income: number;
  expense: number;
  [key: string]: any;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const CategoryPieChart: React.FC<{ data: CategoryData[] }> = ({ data }) => {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <ReTooltip 
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-2 mt-2 px-4">
        {data.slice(0, 6).map((entry, index) => (
          <div key={index} className="flex items-center text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: entry.color }}></span>
            {entry.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export const MonthlyBarChart: React.FC<{ data: MonthlyData[] }> = ({ data }) => {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>;

  const formatXAxis = (tickItem: string) => {
    // If it looks like a full date YYYY-MM-DD (Daily View)
    if (/^\d{4}-\d{2}-\d{2}$/.test(tickItem)) {
      const date = new Date(tickItem);
      // Show "DD/MM"
      return `${date.getDate()}/${date.getMonth() + 1}`;
    }
    // If it looks like YYYY-MM (Monthly View)
    if (/^\d{4}-\d{2}$/.test(tickItem)) {
      const [year, month] = tickItem.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      // Show "ShortMonth 'YY" (e.g. Oct '23)
      return date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    }
    return tickItem;
  };

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11, fill: '#64748b' }} 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={formatXAxis}
            minTickGap={20}
          />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `Rp${(value/1000).toFixed(0)}k`} />
          <ReTooltip 
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => {
               // Format tooltip label nicely as well
               if (typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label)) {
                 return new Date(label).toLocaleDateString('id-ID', { dateStyle: 'full' });
               }
               return label;
            }}
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
