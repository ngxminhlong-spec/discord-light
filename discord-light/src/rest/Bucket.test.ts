import test from 'node:test';
import assert from 'node:assert/strict';
import { Bucket, type QueuedRequest } from './Bucket.js';

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
});

test('Bucket waits when global reset is in the future', async () => {
  const bucket = new Bucket('global-wait', logger as never);
  const startedAt = Date.now();

  bucket.setGlobalReset(startedAt + 50);

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
  assert.ok(elapsed >= 45, `Expected at least ~45ms delay, got ${elapsed}ms`);
});
