import { v4 as uuidv4 } from 'uuid';
import { Customer, Vendor, Invoice, Transaction, KPISnapshot } from '../shared/types';

// Mock Data Seeding for DECYNTRA-X

const orgId = uuidv4();

export const mockCustomers: Customer[] = [
  { id: uuidv4(), name: 'Acme Corp', orgId },
  { id: uuidv4(), name: 'Globex Inc', orgId }, // Overdue > 14 days
  { id: uuidv4(), name: 'Initech', orgId }, // Overdue > 14 days
  { id: uuidv4(), name: 'Umbrella Corp', orgId }, // Borderline
  { id: uuidv4(), name: 'Stark Industries', orgId }
];

export const mockVendors: Vendor[] = [
  { id: uuidv4(), name: 'Supplier A', orgId }, // Payable due in 3 days
  { id: uuidv4(), name: 'Supplier B', orgId },
  { id: uuidv4(), name: 'Supplier C', orgId }
];

export const mockInvoices: Invoice[] = [
  // 10 open invoices (mix: paid/overdue/upcoming)
  { id: uuidv4(), customerId: mockCustomers[1].id, amount: 5000, dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), status: 'overdue' },
  { id: uuidv4(), customerId: mockCustomers[2].id, amount: 8000, dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), status: 'overdue' },
  { id: uuidv4(), customerId: mockCustomers[3].id, amount: 3000, dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), status: 'overdue' },
  { id: uuidv4(), customerId: mockCustomers[0].id, amount: 1500, dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: uuidv4(), customerId: mockCustomers[4].id, amount: 12000, dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: uuidv4(), customerId: mockCustomers[0].id, amount: 2500, dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), status: 'paid' },
  { id: uuidv4(), customerId: mockCustomers[1].id, amount: 4500, dueDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), status: 'paid' },
  { id: uuidv4(), customerId: mockCustomers[2].id, amount: 6500, dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: uuidv4(), customerId: mockCustomers[3].id, amount: 3500, dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: uuidv4(), customerId: mockCustomers[4].id, amount: 9500, dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), status: 'paid' }
];

export const mockTransactions: Transaction[] = Array.from({ length: 45 }).map((_, i) => ({
  id: uuidv4(),
  amount: Math.random() * 10000 * (Math.random() > 0.5 ? 1 : -1), // Random credits/debits
  date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
  type: Math.random() > 0.5 ? 'credit' : 'debit',
  description: `Transaction ${i}`
}));
// Adding anomalous week
for(let i=10; i<17; i++) {
   mockTransactions[i].amount = -20000; // Large debits
   mockTransactions[i].type = 'debit';
}

export const baselineKPI: KPISnapshot = {
  id: uuidv4(),
  orgId: orgId,
  snapshotDate: new Date(),
  decisionLatencyMs: 172800000, // 48 hours
  cashRiskDetectedDaysEarly: 0,
  badDecisionsAvoided: 0,
  aiAccuracyPct: 0,
  totalCashSaved: 0
};
