import { EventEmitter } from 'node:events';
import { Shard } from './Shard.js';
import { Logger, LogLevel } from '../utils/Logger.js';
import type { Client } from '../client/Client.js';

export class ShardManager extends EventEmitter {
  #client: Client;
  #shards: Map<number, Shard> = new Map();
  #token: string;
  #intents: number;
  #gatewayURL: string;
  #shardCount: number;
  #logger: Logger;

  constructor(client: Client, token: string, intents: number, shardCount: number, gatewayURL: string) {
    super();
    this.#client = client;
    this.#token = token;
    this.#intents = intents;
    this.#shardCount = shardCount;
    this.#gatewayURL = gatewayURL;
    this.#logger = new Logger(LogLevel.INFO, 'ShardManager');
  }

  get shards(): Map<number, Shard> {
    return this.#shards;
  }

  async spawn(): Promise<void> {
    this.#logger.info('Spawning %d shard(s)...', this.#shardCount);

    for (let i = 0; i < this.#shardCount; i++) {
      const shard = new Shard(this.#client, i, this.#shardCount, this.#gatewayURL, this.#token, this.#intents);
      this.#shards.set(i, shard);

      shard.on('ready', (data: unknown) => {
        this.emit('shardReady', i, data);
        if (this.#allShardsReady()) {
          this.emit('allShardsReady');
        }
      });

      shard.on('dispatch', (event: string, data: unknown) => {
        this.emit('dispatch', i, event, data);
      });

      shard.on('error', (err: Error) => {
        this.emit('shardError', i, err);
      });

      shard.on('fatal', (code: number, reason: string) => {
        this.#logger.error('Shard %d fatal error: %d %s', i, code, reason);
        this.emit('shardFatal', i, code, reason);
      });

      shard.connect();

      // Stagger shard connections by 5s to avoid rate limits
      if (i < this.#shardCount - 1) {
        await sleep(5000);
      }
    }
  }

  async respawnAll(): Promise<void> {
    this.#logger.warn('Respawning all shards...');
    for (const shard of this.#shards.values()) {
      shard.destroy();
    }
    this.#shards.clear();
    await this.spawn();
  }

  getShard(id: number): Shard | undefined {
    return this.#shards.get(id);
  }

  broadcast(payload: unknown): void {
    for (const shard of this.#shards.values()) {
      // @ts-expect-error - accessing private for broadcast
      shard._send?.(payload) ?? shard.emit('broadcast', payload);
    }
  }

  destroy(): void {
    for (const shard of this.#shards.values()) {
      shard.destroy();
    }
    this.#shards.clear();
  }

  #allShardsReady(): boolean {
    return Array.from(this.#shards.values()).every(s => s.state === 'ready');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
