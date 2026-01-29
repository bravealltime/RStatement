export interface Transaction {
    id: string;
    date: string;
    time?: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category?: string;
}

export interface StatementData {
    bankName: string;
    accountNumber?: string;
    period?: string;
    transactions: Transaction[];
    rawText?: string;
}
