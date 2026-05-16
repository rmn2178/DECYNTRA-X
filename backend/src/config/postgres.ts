import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pgPool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'decyntrax',
  password: process.env.PG_PASSWORD || 'password',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  max: 20, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const initPostgres = async () => {
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (id UUID PRIMARY KEY, name VARCHAR(255));
      CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, orgId UUID, name VARCHAR(255), email VARCHAR(255));
      CREATE TABLE IF NOT EXISTS user_profile (id UUID PRIMARY KEY, userId UUID);
      CREATE TABLE IF NOT EXISTS kpi_snapshots (
        id UUID PRIMARY KEY,
        orgId UUID,
        snapshotDate TIMESTAMP,
        decisionLatencyMs BIGINT,
        cashRiskDetectedDaysEarly INT,
        badDecisionsAvoided INT,
        aiAccuracyPct DECIMAL,
        totalCashSaved DECIMAL
      );
      CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY, name VARCHAR(255), orgId UUID);
      CREATE TABLE IF NOT EXISTS vendors (id UUID PRIMARY KEY, name VARCHAR(255), orgId UUID);
      CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY, customerId UUID, amount DECIMAL, dueDate TIMESTAMP, status VARCHAR(50));
      CREATE TABLE IF NOT EXISTS transactions (id UUID PRIMARY KEY, amount DECIMAL, date TIMESTAMP, type VARCHAR(50));
      CREATE TABLE IF NOT EXISTS decision_log (id UUID PRIMARY KEY, details TEXT);
      CREATE TABLE IF NOT EXISTS decision_outcomes (id UUID PRIMARY KEY, decisionId UUID, outcome TEXT);
      CREATE TABLE IF NOT EXISTS action_queue (id UUID PRIMARY KEY, action TEXT, status VARCHAR(50));
    `);
    console.log('PostgreSQL tables initialized');
  } catch (error) {
    console.error('Error initializing PostgreSQL tables:', error);
  } finally {
    client.release();
  }
};
