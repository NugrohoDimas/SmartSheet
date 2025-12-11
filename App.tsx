import React, { useState, useMemo, useEffect } from 'react';
import { Plus, LayoutDashboard, Table as TableIcon, MessageSquare, TrendingUp, TrendingDown, DollarSign, Link as LinkIcon, X, HelpCircle, RefreshCw, AlertTriangle, CheckCircle, Copy, Code, Wallet, Filter, Calendar } from 'lucide-react';
import { Transaction, TransactionType, SpendingSummary } from './types';
import { CATEGORIES, COLORS } from './constants';
import { categorizeTransactions } from './services/geminiService';
import SummaryCard from './components/SummaryCard';
import { CategoryPieChart, MonthlyBarChart } from './components/Charts';
import TransactionTable from './components/TransactionTable';
import ChatInterface from './components/ChatInterface';

// --- APPS SCRIPT CODE TEMPLATE ---
const APPS_SCRIPT_CODE = `function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().toLowerCase(); });
  var result = [];
  
  // Map rows to objects
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    result.push(row);
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  // Parse text/plain to avoid CORS preflight issues
  var data = JSON.parse(e.postData.contents);
  var headers = sheet.getDataRange().getValues()[0].map(function(h) { return h.toString().toLowerCase(); });
  
  if (data.action === "add") {
    var newRow = [];
    // Ensure we map data to correct columns
    for (var i = 0; i < headers.length; i++) {
      var key = headers[i];
      if (key === 'id') {
        newRow.push(data.transaction.id || 'id-' + new Date().getTime());
      } else {
        // Try exact key or lowercase, or empty string
        var val = data.transaction[key] || data.transaction[key.toLowerCase()] || "";
        newRow.push(val);
      }
    }
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({status: "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (data.action === "delete") {
    var id = data.id;
    var idColIndex = headers.indexOf("id");
    var statusColIndex = headers.indexOf("status");
    
    // If Status column doesn't exist, create it
    if (statusColIndex === -1) {
      sheet.getRange(1, headers.length + 1).setValue("Status");
      statusColIndex = headers.length; 
    }
    
    if (idColIndex === -1) return ContentService.createTextOutput(JSON.stringify({status: "error", message: "No ID column"}));
    
    var values = sheet.getDataRange().getValues();
    // Find row and soft delete
    for (var i = 1; i < values.length; i++) {
      if (values[i][idColIndex] == id) {
        // Update Status column to "Deleted" instead of removing row
        sheet.getRange(i + 1, statusColIndex + 1).setValue("Deleted");
        return ContentService.createTextOutput(JSON.stringify({status: "success"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Unknown action"}));
}`;

// Robust CSV Parsing Helper
const parseCSV = (text: string): Transaction[] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const splitLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(s => s.replace(/^"|"$/g, '').trim());
  };

  let headerRowIndex = -1;
  let colIndices = { date: -1, description: -1, amount: -1, id: -1, category: -1, type: -1, status: -1 };

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const row = splitLine(lines[i]).map(c => c.toLowerCase());
    
    const dateIdx = row.findIndex(c => c.includes('date') || c.includes('day'));
    const amountIdx = row.findIndex(c => c.includes('amount') || c.includes('cost') || c.includes('price') || c.includes('harga'));
    const descIdx = row.findIndex(c => c.includes('desc') || c.includes('name') || c.includes('merchant') || c.includes('keterangan'));
    const idIdx = row.findIndex(c => c.includes('id'));
    const catIdx = row.findIndex(c => c.includes('category') || c.includes('kategori'));
    const typeIdx = row.findIndex(c => c.includes('type') || c.includes('tipe'));
    const statusIdx = row.findIndex(c => c.includes('status') || c.includes('state'));

    if (dateIdx !== -1 && amountIdx !== -1) {
      headerRowIndex = i;
      colIndices = { date: dateIdx, amount: amountIdx, description: descIdx, id: idIdx, category: catIdx, type: typeIdx, status: statusIdx };
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colIndices = { date: 0, description: 1, amount: 2, id: -1, category: -1, type: -1, status: -1 };
  }

  const transactions: Transaction[] = [];

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const row = splitLine(lines[i]);
    if (row.length < 2) continue;

    // Check status first - if deleted, skip
    const statusStr = colIndices.status !== -1 ? row[colIndices.status] : '';
    if (statusStr && statusStr.toLowerCase() === 'deleted') continue;

    let descIndexToUse = colIndices.description;
    if (descIndexToUse === -1 || descIndexToUse >= row.length) {
        for(let j=0; j<row.length; j++) {
            if (j !== colIndices.date && j !== colIndices.amount) {
                descIndexToUse = j;
                break;
            }
        }
    }

    const dateStr = row[colIndices.date] || '';
    const amountStr = row[colIndices.amount] || '0';
    const descStr = (descIndexToUse !== -1 ? row[descIndexToUse] : 'Unspecified Transaction') || 'Unspecified';
    const idStr = colIndices.id !== -1 ? row[colIndices.id] : `sheet-${i}-${Math.random().toString(36).substr(2,5)}`;
    const catStr = colIndices.category !== -1 ? row[colIndices.category] : '';
    const typeStr = colIndices.type !== -1 ? row[colIndices.type] : '';

    // Handle Rupiah format if present in CSV
    let cleanAmountStr = amountStr.replace(/[$£€Rp]/g, '').replace(/,/g, '');
    if (cleanAmountStr.startsWith('(') && cleanAmountStr.endsWith(')')) {
        cleanAmountStr = '-' + cleanAmountStr.slice(1, -1);
    }
    
    let amount = parseFloat(cleanAmountStr);
    if (isNaN(amount)) continue;

    let type = TransactionType.EXPENSE;
    if (typeStr) {
      type = typeStr.toLowerCase().includes('income') || typeStr.toLowerCase().includes('pemasukan') ? TransactionType.INCOME : TransactionType.EXPENSE;
    } else if (amount < 0) {
       // Negative amount logic if needed
    }
    
    const timestamp = Date.parse(dateStr);
    if (isNaN(timestamp)) continue;
    const isoDate = new Date(timestamp).toISOString().split('T')[0];

    transactions.push({
      id: idStr,
      date: isoDate,
      description: descStr,
      amount: Math.abs(amount),
      category: catStr || 'Uncategorized',
      type: type
    });
  }

  return transactions;
};

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'chat'>('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Filter State
  const [filterMode, setFilterMode] = useState<'all' | 'year' | 'month' | 'day'>('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [connectionMode, setConnectionMode] = useState<'read-only' | 'read-write'>('read-only');

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };

  // Load from local storage
  useEffect(() => {
    const savedUrl = localStorage.getItem('smartSheetUrl');
    if (savedUrl) {
      setSheetUrl(savedUrl);
      if (savedUrl.includes('/exec')) {
        setConnectionMode('read-write');
      } else {
        setConnectionMode('read-only');
      }
      fetchSheetData(savedUrl, true);
    }
  }, []);

  // Filter Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      
      if (filterMode === 'all') return true;
      
      if (filterMode === 'year') {
        return tDate.getFullYear() === selectedYear;
      }
      
      if (filterMode === 'month') {
        return tDate.getFullYear() === selectedYear && tDate.getMonth() === selectedMonth;
      }

      if (filterMode === 'day') {
        return t.date === selectedDay;
      }

      return true;
    });
  }, [transactions, filterMode, selectedYear, selectedMonth, selectedDay]);

  // Get available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(t => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Stats Calculation based on filtered data
  const summary: SpendingSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    const catMap: Record<string, number> = {};

    filteredTransactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        income += t.amount;
      } else {
        expense += t.amount;
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      }
    });

    const categoryBreakdown = Object.entries(catMap)
      .map(([name, value], idx) => ({
        name,
        value,
        color: COLORS[idx % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);

    const monthMap: Record<string, { income: number; expense: number }> = {};
    filteredTransactions.forEach(t => {
      const dateObj = new Date(t.date);
      
      // If filtering by day or month, seeing hourly/daily trends might be better, 
      // but keeping it simple with daily aggregation for the bar chart
      let key = '';
      if (filterMode === 'day') {
         key = t.date; // Just one bar
      } else if (filterMode === 'month') {
         key = t.date; // Daily bars
      } else {
         // Monthly bars
         key = isNaN(dateObj.getTime()) 
          ? t.date.substring(0, 7) 
          : dateObj.toISOString().substring(0, 7);
      }

      if (!monthMap[key]) monthMap[key] = { income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) monthMap[key].income += t.amount;
      else monthMap[key].expense += t.amount;
    });
    
    const monthlyTrend = Object.entries(monthMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
      categoryBreakdown,
      monthlyTrend
    };
  }, [filteredTransactions, filterMode]);

  const fetchSheetData = async (url: string, isAutoFetch = false) => {
    if (!url) return;
    setIsProcessing(true);
    
    try {
      const isScript = url.includes('/exec');
      setConnectionMode(isScript ? 'read-write' : 'read-only');
      
      let rawTransactions: Transaction[] = [];

      if (isScript) {
        // Apps Script Fetch (JSON)
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch from script.');
        const jsonData = await response.json();
        
        if (!Array.isArray(jsonData)) throw new Error("Script returned invalid data format.");

        // Filter out deleted rows and map
        rawTransactions = jsonData
          .filter((row: any) => !row.status || String(row.status).toLowerCase() !== 'deleted')
          .map((row: any) => ({
            id: row.id ? String(row.id) : `gen-${Math.random().toString(36)}`,
            date: row.date ? new Date(row.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            description: row.description || 'Unknown',
            amount: Number(row.amount) || 0,
            category: row.category || 'Uncategorized',
            type: (row.type && String(row.type).toLowerCase() === 'income') ? TransactionType.INCOME : TransactionType.EXPENSE
          }));
      } else {
        // CSV Fetch
        if (!url.includes('google.com/spreadsheets') || !url.includes('output=csv')) {
          throw new Error("Invalid URL for Read-Only mode. Use 'Publish to Web' CSV.");
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch CSV.');
        const text = await response.text();
        rawTransactions = parseCSV(text);
      }

      // Check which transactions need AI categorization
      const needsAi = rawTransactions.filter(t => 
        !t.category || t.category === 'Uncategorized' || t.category === 'Other'
      );
      
      const hasAi = rawTransactions.filter(t => 
        t.category && t.category !== 'Uncategorized' && t.category !== 'Other'
      );

      let finalTransactions = [...hasAi];

      if (needsAi.length > 0) {
        const aiProcessed = await categorizeTransactions(needsAi);
        finalTransactions = [...finalTransactions, ...aiProcessed];
      }

      // Sort by date desc
      finalTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(finalTransactions);
      setLastUpdated(new Date());
      localStorage.setItem('smartSheetUrl', url);

      if (!isAutoFetch) {
        setShowConnectModal(false);
        showNotification('Sheet connected successfully!', 'success');
      }
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || "Error syncing sheet.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    fetchSheetData(sheetUrl);
  };

  const handleRefresh = () => {
    const savedUrl = localStorage.getItem('smartSheetUrl');
    if (savedUrl) fetchSheetData(savedUrl);
  };

  const handleDelete = async (id: string) => {
    // Optimistic UI update - remove from view
    const previousTransactions = [...transactions];
    setTransactions(prev => prev.filter(t => t.id !== id));

    if (connectionMode === 'read-write') {
      try {
        const response = await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'delete', id: id })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error('Delete failed on sheet');
        showNotification('Transaction marked as Deleted.', 'success');
      } catch (error) {
        console.error("Delete sync error:", error);
        showNotification("Failed to delete from Sheet. Reverting.", 'error');
        setTransactions(previousTransactions);
      }
    } else {
      showNotification('Transaction removed from view.', 'success');
    }
  };

  // Add Transaction Modal State
  const [newTrans, setNewTrans] = useState({ 
    description: '', 
    amount: '', 
    date: new Date().toISOString().split('T')[0],
    type: TransactionType.EXPENSE,
    category: CATEGORIES[0]
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    const newId = `id-${Date.now()}`;
    const manualTransaction: Transaction = {
      id: newId,
      description: newTrans.description,
      amount: parseFloat(newTrans.amount),
      date: newTrans.date,
      type: newTrans.type,
      category: newTrans.category
    };

    // Optimistic update
    setTransactions(prev => [manualTransaction, ...prev]);
    setShowAddModal(false);
    
    if (connectionMode === 'read-write') {
      try {
        const payload = {
          action: 'add',
          // Include status='Active' for consistency
          transaction: { ...manualTransaction, status: 'Active' }
        };
        const response = await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error('Save failed on sheet');
        showNotification('Transaction saved to Sheet.', 'success');
      } catch (error) {
        console.error("Save sync error:", error);
        showNotification("Failed to save to Sheet. Please refresh.", 'error');
      }
    } else {
      showNotification('Transaction added locally.', 'success');
    }

    setNewTrans({ 
      description: '', 
      amount: '', 
      date: new Date().toISOString().split('T')[0],
      type: TransactionType.EXPENSE,
      category: CATEGORIES[0]
    });
    setIsProcessing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification("Code copied to clipboard!", 'success');
  };

  const [setupTab, setSetupTab] = useState<'simple' | 'advanced'>('simple');

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f3f4f6]">
      {/* Sidebar Navigation */}
      <nav className="md:w-64 bg-white border-r border-gray-200 flex flex-col sticky top-0 md:h-screen z-20">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <span className="text-xl font-bold text-gray-800 tracking-tight">SmartSheet</span>
        </div>
        
        <div className="p-4 flex flex-col gap-2 flex-grow">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'transactions' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <TableIcon size={20} />
            Transactions
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'chat' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <MessageSquare size={20} />
            AI Assistant
          </button>
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          {localStorage.getItem('smartSheetUrl') ? (
            <div className="space-y-2">
              <div className={`text-xs font-medium flex items-center gap-1 ${connectionMode === 'read-write' ? 'text-indigo-600' : 'text-green-600'}`}>
                 <div className={`w-2 h-2 rounded-full animate-pulse ${connectionMode === 'read-write' ? 'bg-indigo-500' : 'bg-green-500'}`}></div>
                 {connectionMode === 'read-write' ? '2-Way Sync Active' : 'Read-Only Mode'}
              </div>
              <button 
                onClick={handleRefresh}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-medium transition-all"
              >
                <RefreshCw size={14} className={isProcessing ? "animate-spin" : ""} />
                {isProcessing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button 
                onClick={() => setShowConnectModal(true)}
                className="text-xs text-indigo-600 hover:underline w-full text-center"
              >
                Sync Settings
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowConnectModal(true)}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-gray-200 hover:border-green-400 hover:text-green-700 text-gray-600 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <LinkIcon size={18} />
              Connect Sheet
            </button>
          )}
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-indigo-200"
          >
            <Plus size={18} />
            Add Transaction
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 h-screen relative">
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab === 'dashboard' && 'Financial Overview'}
                {activeTab === 'transactions' && 'Transaction History'}
                {activeTab === 'chat' && 'Spending Analysis'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                 <p className="text-gray-500 text-sm">Track, analyze, and optimize your spending.</p>
                 {lastUpdated && (
                   <span className="text-xs text-gray-400 border-l border-gray-300 pl-2">
                      Updated: {lastUpdated.toLocaleTimeString()}
                   </span>
                 )}
              </div>
            </div>
            <div className="hidden md:block text-right">
               <div className="text-xs text-gray-400 uppercase font-semibold">Current Balance</div>
               <div className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(summary.balance)}
               </div>
            </div>
          </div>
          
          {/* Filter Bar (Only on Dashboard) */}
          {activeTab === 'dashboard' && transactions.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
               <div className="flex items-center gap-2 text-gray-900 text-sm font-medium pr-3 border-r border-gray-200">
                  <Filter size={16} className="text-gray-900" />
                  <span>Filter:</span>
               </div>
               
               <div className="flex bg-gray-100 p-1 rounded-lg">
                  {(['all', 'year', 'month', 'day'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setFilterMode(mode)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${filterMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
               </div>

               {filterMode !== 'all' && (
                 <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    {/* Year Selector - Show if NOT in day mode */}
                    {filterMode !== 'day' && (
                      <select 
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="text-sm bg-gray-50 text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {availableYears.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    )}

                    {/* Month Selector - Show ONLY if in Month mode */}
                    {filterMode === 'month' && (
                       <select 
                         value={selectedMonth}
                         onChange={(e) => setSelectedMonth(Number(e.target.value))}
                         className="text-sm bg-gray-50 text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                       >
                         {Array.from({length: 12}).map((_, i) => (
                           <option key={i} value={i}>
                             {new Date(0, i).toLocaleString('default', { month: 'long' })}
                           </option>
                         ))}
                       </select>
                    )}

                    {/* Day Selector */}
                    {filterMode === 'day' && (
                       <input 
                          type="date"
                          value={selectedDay}
                          onChange={(e) => setSelectedDay(e.target.value)}
                          className="text-sm bg-gray-50 text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                          style={{ colorScheme: 'light' }}
                       />
                    )}
                 </div>
               )}
            </div>
          )}
        </header>

        {transactions.length === 0 && !isProcessing ? (
          <div className="flex flex-col items-center justify-center h-96 text-center space-y-4 bg-white rounded-2xl border border-dashed border-gray-300 p-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
              <TableIcon size={32} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">No transactions yet</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-1">
                Connect a Google Sheet to automatically import your spending data, or add transactions manually.
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowConnectModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm flex items-center gap-2"
              >
                <LinkIcon size={16} /> Connect Sheet
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm flex items-center gap-2"
              >
                <Plus size={16} /> Add Manual
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SummaryCard 
                    title="Total Income" 
                    amount={summary.totalIncome} 
                    type="positive" 
                    icon={<TrendingUp size={20} className="text-green-600" />}
                  />
                  <SummaryCard 
                    title="Total Expenses" 
                    amount={summary.totalExpense} 
                    type="negative"
                    icon={<TrendingDown size={20} className="text-red-600" />} 
                  />
                  <SummaryCard 
                    title="Net Balance" 
                    amount={summary.balance} 
                    type={summary.balance >= 0 ? 'neutral' : 'negative'}
                    icon={<Wallet size={20} className="text-blue-600" />}
                  />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-800">Spending by Category</h3>
                      <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                         {filterMode === 'all' ? 'All Time' : filterMode.charAt(0).toUpperCase() + filterMode.slice(1)} View
                      </div>
                    </div>
                    <CategoryPieChart data={summary.categoryBreakdown} />
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                       <h3 className="text-lg font-semibold text-gray-800">
                         {filterMode === 'month' ? 'Daily Trends' : filterMode === 'day' ? 'Single Day View' : 'Monthly Trends'}
                       </h3>
                    </div>
                    <MonthlyBarChart data={summary.monthlyTrend} />
                  </div>
                </div>

                {/* Mini Recent Transactions */}
                <div className="h-96">
                  <TransactionTable transactions={filteredTransactions.slice(0, 50)} onDelete={handleDelete} />
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="h-[calc(100vh-140px)]">
                 {connectionMode === 'read-only' && (
                    <div className="mb-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                       <AlertTriangle size={16} />
                       You are in Read-Only mode. Deleting here won't affect your Sheet. Switch to Advanced mode to enable 2-way sync.
                    </div>
                 )}
                <TransactionTable transactions={transactions} onDelete={handleDelete} />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="h-[calc(100vh-140px)]">
                <ChatInterface transactions={transactions} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl transition-all duration-300 transform translate-y-0 ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
          <div>
            <h4 className="font-bold text-sm">{notification.type === 'success' ? 'Success' : 'Error'}</h4>
            <p className="text-sm opacity-90">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="ml-2 text-white/80 hover:text-white">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add Transaction</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input 
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newTrans.description}
                  onChange={e => setNewTrans({...newTrans, description: e.target.value})}
                  placeholder="e.g. Nasi Goreng"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rp)</label>
                  <input 
                    required
                    type="number"
                    step="1000"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newTrans.amount}
                    onChange={e => setNewTrans({...newTrans, amount: e.target.value})}
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input 
                    required
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newTrans.date}
                    onChange={e => setNewTrans({...newTrans, date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newTrans.type}
                    onChange={e => setNewTrans({...newTrans, type: e.target.value as TransactionType})}
                  >
                    <option value={TransactionType.EXPENSE}>Expense</option>
                    <option value={TransactionType.INCOME}>Income</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newTrans.category}
                    onChange={e => setNewTrans({...newTrans, category: e.target.value})}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-70 font-medium shadow-lg shadow-indigo-200"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Sheet Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <LinkIcon size={20} className="text-indigo-700" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Sync Settings</h2>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-gray-100">
              <button 
                onClick={() => setSetupTab('simple')}
                className={`pb-2 px-2 text-sm font-medium transition-all ${setupTab === 'simple' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Read Only (Simple)
              </button>
              <button 
                onClick={() => setSetupTab('advanced')}
                className={`pb-2 px-2 text-sm font-medium transition-all ${setupTab === 'advanced' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Read & Write (Advanced)
              </button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2">
              {setupTab === 'simple' ? (
                <div className="space-y-4">
                   <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <HelpCircle size={16} /> How to connect (Read Only):
                      </h3>
                      <ol className="list-decimal list-inside text-sm text-blue-700 space-y-2 ml-1">
                        <li>Open your Google Sheet</li>
                        <li>Go to <strong>File</strong> &gt; <strong>Share</strong> &gt; <strong>Publish to web</strong></li>
                        <li>Select <strong>Sheet1</strong> and <strong>Comma-separated values (.csv)</strong></li>
                        <li>Click <strong>Publish</strong> and copy the link below</li>
                      </ol>
                   </div>
                   <p className="text-xs text-gray-500">Note: In this mode, adding or deleting transactions in the app <strong>will not</strong> change your Google Sheet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                         <Code size={16} /> Setup Two-Way Sync (Apps Script):
                      </h3>
                      <div className="text-sm text-indigo-700 mb-2 bg-indigo-100 p-2 rounded border border-indigo-200">
                        <strong>Important:</strong> If the "Soft Delete" feature isn't working (rows are still being deleted), you must <strong>copy the new code below</strong> and deploy a <strong>New Version</strong> in Apps Script.
                      </div>
                      <ol className="list-decimal list-inside text-sm text-indigo-700 space-y-2 ml-1">
                        <li>Open your Google Sheet</li>
                        <li>Go to <strong>Extensions</strong> &gt; <strong>Apps Script</strong></li>
                        <li>Paste the code below into the editor (replace existing code)</li>
                        <li>Click <strong>Deploy</strong> &gt; <strong>New Deployment</strong></li>
                        <li>Select type <strong>Web app</strong></li>
                        <li>Set "Who has access" to <strong>Anyone</strong> (Important!)</li>
                        <li>Click <strong>Deploy</strong> and copy the <strong>Web App URL</strong></li>
                      </ol>
                   </div>

                   <div className="relative">
                      <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto h-40">
                        {APPS_SCRIPT_CODE}
                      </pre>
                      <button 
                        onClick={() => copyToClipboard(APPS_SCRIPT_CODE)}
                        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                        title="Copy Code"
                      >
                        <Copy size={14} />
                      </button>
                   </div>
                   
                   <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-xs">
                      <AlertTriangle size={16} className="flex-shrink-0" />
                      <div>
                        Ensure your sheet has these headers: <strong>ID, Date, Description, Amount, Category, Type</strong>. 
                        The script will automatically add a <strong>Status</strong> column to handle soft deletes.
                      </div>
                   </div>
                </div>
              )}
            </div>

            <form onSubmit={handleConnectSubmit} className="mt-6 pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {setupTab === 'simple' ? 'CSV Link' : 'Web App URL'}
              </label>
              <div className="flex gap-2">
                <input 
                  required
                  type="url"
                  className="flex-grow border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400"
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  placeholder={setupTab === 'simple' ? "https://docs.google.com/.../pub?output=csv" : "https://script.google.com/macros/s/.../exec"}
                />
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-70 font-medium shadow-md shadow-indigo-200 flex items-center gap-2 whitespace-nowrap"
                >
                  {isProcessing ? 'Syncing...' : 'Save & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}