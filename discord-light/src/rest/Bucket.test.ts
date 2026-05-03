import test from 'node:test';
import assert from 'node:assert/strict';
import { Bucket, type QueuedRequest } from './Bucket.js';
import type { Logger } from '../utils/Logger.js';

const logger: Pick<Logger, 'debug'> = {
  debug: () => {},
};

test('Bucket processes queued requests in FIFO order', async () => {
  const bucket = new Bucket('test-bucket', logger as Logger);

const logger = {
  debug: () => {},
} as const;

test('Bucket processes queued requests in FIFO order', async () => {
  const bucket = new Bucket('test-bucket', logger as never);
  const executionOrder: number[] = [];

  const createRequest = (id: number): Promise<number> => new Promise((resolve, reject) => {
    const req: QueuedRequest = {
      resolve: (value) => resolve(value as number),
      reject,
      retries: 0,
      execute: async () => {
        executionOrder.push(id);
        return id;
      },
    };
    bucket.add(req);
  });

  const results = await Promise.all([createRequest(1), createRequest(2), createRequest(3)]);

  assert.deepEqual(results, [1, 2, 3]);
  assert.deepEqual(executionOrder, [1, 2, 3]);
  assert.equal(bucket.size, 0);
});

test('Bucket waits when global reset is in the future', async () => {
  const bucket = new Bucket('global-wait', logger as Logger);
  const startedAt = Date.now();

  bucket.setGlobalReset(startedAt + 100);

  await new Promise<void>((resolve, reject) => {
    const req: QueuedRequest = {
      resolve: () => resolve(),
      reject,
      retries: 0,
      execute: async () => true,
    };
    bucket.add(req);
  });

  const elapsed = Date.now() - startedAt;
  assert.ok(elapsed >= 85, `Expected at least ~85ms delay, got ${elapsed}ms`);
});

test('Bucket continues processing after a rejected request', async () => {
  const bucket = new Bucket('error-continue', logger as Logger);
  const executionOrder: string[] = [];

  const first = new Promise<string>((resolve) => {
    const req: QueuedRequest = {
      resolve: () => resolve('unexpected'),
      reject: () => resolve('rejected'),
      retries: 0,
      execute: async () => {
        executionOrder.push('first');
        throw new Error('boom');
      },
    };
    bucket.add(req);
  });

  const second = new Promise<string>((resolve, reject) => {
    const req: QueuedRequest = {
      resolve: () => resolve('resolved'),
      reject,
      retries: 0,
      execute: async () => {
        executionOrder.push('second');
        return true;
      },
    };
    bucket.add(req);
  });

  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult, 'rejected');
  assert.equal(secondResult, 'resolved');
  assert.deepEqual(executionOrder, ['first', 'second']);
  assert.equal(bucket.size, 0);
});

test('Bucket waits for route rate-limit reset before executing', async () => {
  const bucket = new Bucket('bucket-wait', logger as Logger);
  const startedAt = Date.now();

  bucket.updateRateLimit({
    limit: 5,
    remaining: 0,
    reset: startedAt + 90,
    resetAfter: 90,
    bucket: 'bucket-wait',
  });

  await new Promise<void>((resolve, reject) => {
    const req: QueuedRequest = {
      resolve: () => resolve(),
      reject,
      retries: 0,
      execute: async () => {
        bucket.updateRateLimit({
          limit: 5,
          remaining: 4,
          reset: Date.now() + 1000,
          resetAfter: 1000,
          bucket: 'bucket-wait',
        });
        return true;
      },
    };
    bucket.add(req);
  });

  const elapsed = Date.now() - startedAt;
  assert.ok(elapsed >= 75, `Expected at least ~75ms delay, got ${elapsed}ms`);
  assert.ok(elapsed >= 45, `Expected at least ~45ms delay, got ${elapsed}ms`);
});
