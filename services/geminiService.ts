import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType } from '../types';
import { CATEGORIES } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using gemini-2.5-flash for speed and efficiency in data tasks
const MODEL_NAME = 'gemini-2.5-flash'; 

export const categorizeTransactions = async (rawTransactions: Partial<Transaction>[]): Promise<Transaction[]> => {
  const transactionDescriptions = rawTransactions.map(t => `${t.description} ($${t.amount})`).join('\n');
  
  const prompt = `
    You are a financial assistant. I have a list of transactions. 
    Please assign the most appropriate category to each transaction from this list: ${CATEGORIES.join(', ')}.
    If it looks like income (e.g., Salary, Deposit), mark type as INCOME, otherwise EXPENSE.
    
    Transactions:
    ${transactionDescriptions}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalDescription: { type: Type.STRING },
              category: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['INCOME', 'EXPENSE'] }
            },
            propertyOrdering: ["originalDescription", "category", "type"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');
    
    // Merge AI results back with original data
    return rawTransactions.map((t, index) => {
      const aiResult = result[index];
      return {
        ...t,
        id: t.id || Math.random().toString(36).substr(2, 9),
        date: t.date || new Date().toISOString().split('T')[0],
        category: aiResult?.category || 'Other',
        type: aiResult?.type || 'EXPENSE',
        amount: Number(t.amount) || 0,
        description: t.description || 'Unknown'
      } as Transaction;
    });

  } catch (error) {
    console.error("Error categorizing transactions:", error);
    // Fallback: return original with defaults
    return rawTransactions.map(t => ({
      ...t,
      id: t.id || Math.random().toString(36).substr(2, 9),
      date: t.date || new Date().toISOString().split('T')[0],
      category: 'Other',
      type: 'EXPENSE',
      amount: Number(t.amount) || 0,
      description: t.description || 'Unknown'
    } as Transaction));
  }
};

export const getFinancialInsights = async (transactions: Transaction[], userQuery?: string): Promise<string> => {
  // Limit transaction context to avoid token limits if list is huge, though Flash 2.5 has large context window.
  // We'll summarize simply by JSON stringifying.
  const context = JSON.stringify(transactions.map(t => ({
    date: t.date,
    desc: t.description,
    amount: t.amount,
    cat: t.category,
    type: t.type
  })));

  const systemInstruction = `You are a savvy financial analyst. Analyze the provided transaction JSON data. 
  Your goal is to provide helpful, actionable, and sometimes witty insights about the user's spending habits.
  Keep responses concise and formatted with Markdown.`;

  const prompt = userQuery 
    ? `Here is my transaction data: ${context}. \n\nUser Question: ${userQuery}`
    : `Here is my transaction data: ${context}. \n\nPlease provide a brief spending analysis. Point out the biggest expenses, suggest where I can save, and give an overall financial health score (0-100).`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    return response.text || "I couldn't generate an analysis at this time.";
  } catch (error) {
    console.error("Error generating insight:", error);
    return "Sorry, I encountered an error analyzing your data.";
  }
};

export const scanReceipt = async (base64Image: string): Promise<Partial<Transaction>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Assuming jpeg/png, standardizing
              data: base64Image
            }
          },
          {
            text: `Extract data from this receipt. 
            IMPORTANT: If the receipt contains multiple items, DO NOT return multiple objects.
            Instead, aggregate them into ONE single transaction:
            1. Sum up the Total Amount of all items.
            2. Combine item names into a single Description (e.g., "Indomaret: Bread, Milk, Candy").
            3. Choose the one Category that best fits the majority of items from this list: ${CATEGORIES.join(', ')}.
            4. Extract the Date.

            Return a single JSON object.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      amount: result.amount,
      date: result.date,
      description: result.description,
      category: result.category,
      type: TransactionType.EXPENSE // Receipts are usually expenses
    };

  } catch (error) {
    console.error("Error scanning receipt:", error);
    throw new Error("Could not extract data from image.");
  }
};