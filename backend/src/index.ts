import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initPostgres } from './config/postgres';
import { initNeo4j } from './config/neo4j';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/graph', (req, res) => res.json({ message: 'Graph route' }));
app.get('/api/decisions', (req, res) => res.json({ message: 'Decisions route' }));
app.get('/api/analytics', (req, res) => res.json({ message: 'Analytics route' }));
app.get('/api/outcomes', (req, res) => res.json({ message: 'Outcomes route' }));
app.post('/api/simulate', (req, res) => res.json({ message: 'Simulate route' }));
app.post('/api/execute', (req, res) => res.json({ message: 'Execute route' }));
app.get('/api/kpi', (req, res) => res.json({ message: 'KPI route' }));

const startServer = async () => {
  await initPostgres();
  await initNeo4j();
  
  app.listen(port, () => {
    console.log(`DECYNTRA-X Backend listening on port ${port}`);
  });
};

startServer();
