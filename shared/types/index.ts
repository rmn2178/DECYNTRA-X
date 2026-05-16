export interface KPISnapshot {
  id: string;
  orgId: string;
  snapshotDate: Date;
  decisionLatencyMs: number;
  cashRiskDetectedDaysEarly: number;
  badDecisionsAvoided: number;
  aiAccuracyPct: number;
  totalCashSaved: number;
}

export interface Customer {
  id: string;
  name: string;
  orgId: string;
}

export interface Vendor {
  id: string;
  name: string;
  orgId: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  amount: number;
  dueDate: Date;
  status: 'paid' | 'overdue' | 'upcoming';
}

export interface Transaction {
  id: string;
  amount: number;
  date: Date;
  type: 'credit' | 'debit';
  description: string;
}
