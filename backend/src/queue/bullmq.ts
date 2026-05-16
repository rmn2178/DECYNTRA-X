import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const actionQueue = new Queue('action_queue', { connection });

export const actionWorker = new Worker('action_queue', async job => {
  console.log(`Processing job ${job.id} of type ${job.name}`);
  // Add job processing logic here
}, { connection });

actionWorker.on('completed', job => {
  console.log(`${job.id} has completed!`);
});

actionWorker.on('failed', (job, err) => {
  console.log(`${job?.id} has failed with ${err.message}`);
});
