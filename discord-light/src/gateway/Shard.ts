// @ts-nocheck
import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { GatewayOpcodes, ResumeableCloseCodes, FatalCloseCodes } from '../utils/Constants.js';
import { Logger, LogLevel } from '../utils/Logger.js';

interface GatewayPayload {
  op: number;
  d?: unknown;
  s?: number;
  t?: string;
}

type ShardState = 'idle' | 'connecting' | 'identifying' | 'ready' | 'resuming' | 'disconnected' | 'reconnecting';

// Pre-compiled constants to avoid repeated allocations
const GATEWAY_VERSION = '10';
const GATEWAY_ENCODING = 'json';
const MAX_MISSED_HEARTBEATS = 2;
const RECONNECT_BASE = 500; // Reduced from 1000ms
const RECONNECT_MAX_ATTEMPTS = 6; // 2^6 = 64x multiplier
const RECONNECT_MAX_DELAY = 30000; // Reduced from 60000ms

export class Shard extends EventEmitter {
  #id: number;
  #ws: WebSocket | null = null;
  #heartbeatInterval: NodeJS.Timeout | null = null;
  #heartbeatTimeout: NodeJS.Timeout | null = null;
  #seq: number | null = null;
  #sessionId: string | null = null;
  #heartbeatAck = true;
  #missedHeartbeats = 0;
  #reconnectTimer: NodeJS.Timeout | null = null;
  #intents: number;
  #token: string;
  #gatewayURL: string;
  #state: ShardState = 'idle';
  #logger: Logger;
  #totalShards: number;
  #closeCount = 0;
  #lastReadyAt = 0;
  #messageBuffer: GatewayPayload[] = []; // Buffer for batching
  #isProcessingMessages = false;

  constructor(
    _client: unknown,
    id: number,
    totalShards: number,
    gatewayURL: string,
    token: string,
    intents: number
  ) {
    super();
    this.#id = id;
    this.#totalShards = totalShards;
    this.#gatewayURL = gatewayURL;
    this.#token = token;
    this.#intents = intents;
    this.#logger = new Logger(LogLevel.INFO, `Shard[${id}]`);
  }

  get id(): number {
    return this.#id;
  }

  get state(): ShardState {
    return this.#state;
  }

  get sessionId(): string | null {
    return this.#sessionId;
  }

  get sequence(): number | null {
    return this.#seq;
  }

  get ping(): number {
    return this.#lastReadyAt ? Date.now() - this.#lastReadyAt : -1;
  }

  connect(): void {
    if (this.#state === 'connecting' || this.#state === 'ready') {
      this.#logger.warn('Connect called while in state: %s', this.#state);
      return;
    }

    this.#state = 'connecting';
    this.#logger.info('Connecting to gateway...');

    const url = new URL(this.#gatewayURL);
    url.searchParams.set('v', GATEWAY_VERSION);
    url.searchParams.set('encoding', GATEWAY_ENCODING);

    // Connection pool settings for better performance
    this.#ws = new WebSocket(url.toString(), {
      perMessageDeflate: false, // Disable compression for lower latency
      handshakeTimeout: 10000,
    });

    this.#ws.on('open', () => this.#onOpen());
    this.#ws.on('message', (data) => this.#onMessage(data));
    this.#ws.on('close', (code, reason) => this.#onClose(code, reason));
    this.#ws.on('error', (err) => this.#onError(err));
  }

  #onOpen(): void {
    this.#logger.info('WebSocket opened');
    this.emit('open');
  }

  /**
   * Buffer and batch message processing
   */
  #onMessage(data: WebSocket.RawData): void {
    let payload: GatewayPayload;
    try {
      payload = JSON.parse(data.toString('utf8'));
    } catch {
      this.#logger.warn('Failed to parse gateway payload');
      return;
    }

    // Buffer message and process in batch
    this.#messageBuffer.push(payload);
    if (!this.#isProcessingMessages) {
      this.#isProcessingMessages = true;
      setImmediate(() => this.#processMessageBuffer());
    }
  }

  /**
   * Process batched messages to reduce event loop pressure
   */
  #processMessageBuffer(): void {
    const batch = this.#messageBuffer.splice(0, 20); // Process up to 20 messages per batch
    for (const payload of batch) {
      this.#handlePayload(payload);
    }

    this.#isProcessingMessages = false;

    if (this.#messageBuffer.length > 0) {
      this.#isProcessingMessages = true;
      setImmediate(() => this.#processMessageBuffer());
    }
  }

  /**
   * Handle single payload
   */
  #handlePayload(payload: GatewayPayload): void {
    if (payload.s !== undefined && payload.s !== null) {
      this.#seq = payload.s;
    }

    switch (payload.op) {
      case GatewayOpcodes.HELLO:
        this.#handleHello(payload.d as { heartbeat_interval: number });
        break;

      case GatewayOpcodes.HEARTBEAT_ACK:
        this.#heartbeatAck = true;
        this.#missedHeartbeats = 0;
        break;

      case GatewayOpcodes.DISPATCH:
        this.#handleDispatch(payload.t!, payload.d);
        break;

      case GatewayOpcodes.INVALID_SESSION:
        this.#handleInvalidSession(payload.d as boolean);
        break;

      case GatewayOpcodes.RECONNECT:
        this.#logger.info('Gateway requested reconnect');
        this.#ws?.close(4000, 'Reconnect requested');
        break;

      case GatewayOpcodes.HEARTBEAT:
        this.#sendHeartbeat();
        break;
    }
  }

  #handleHello(data: { heartbeat_interval: number }): void {
    this.#startHeartbeat(data.heartbeat_interval);
    if (this.#sessionId && this.#seq !== null) {
      this.#state = 'resuming';
      this.#logger.info('Resuming session %s at seq %d', this.#sessionId, this.#seq);
      this.#sendResume();
    } else {
      this.#state = 'identifying';
      this.#logger.info('Identifying...');
      this.#sendIdentify();
    }
  }

  #handleDispatch(event: string, data: unknown): void {
    if (event === 'READY') {
      const readyData = data as { session_id: string };
      this.#state = 'ready';
      this.#sessionId = readyData.session_id;
      this.#closeCount = 0;
      this.#lastReadyAt = Date.now();
      this.#logger.info('Ready! Session: %s', this.#sessionId);
      this.emit('ready', data);
    } else if (event === 'RESUMED') {
      this.#state = 'ready';
      this.#closeCount = 0;
      this.#logger.info('Session resumed successfully');
      this.emit('resumed');
    }
    this.emit('dispatch', event, data);
  }

  #handleInvalidSession(resumable: boolean): void {
    if (resumable && this.#sessionId) {
      this.#logger.warn('Invalid session but resumable');
      this.#sendResume();
    } else {
      this.#logger.warn('Invalid session, clearing state and re-identifying');
      this.#sessionId = null;
      this.#seq = null;
      setTimeout(() => this.#sendIdentify(), 5000);
    }
  }

  #onClose(code: number, reason: Buffer): void {
    const reasonStr = reason.toString() || 'No reason';
    this.#logger.warn('WebSocket closed with code %d: %s', code, reasonStr);
    this.#cleanup();

    if (FatalCloseCodes.includes(code)) {
      this.#logger.error('Fatal close code %d. Will not reconnect.', code);
      this.#state = 'disconnected';
      this.emit('fatal', code, reasonStr);
      return;
    }

    if (ResumeableCloseCodes.includes(code) && this.#sessionId) {
      this.#state = 'reconnecting';
      this.#logger.info('Close code %d is resumeable. Attempting resume...', code);
      this.#scheduleReconnect();
    } else {
      this.#sessionId = null;
      this.#seq = null;
      this.#state = 'reconnecting';
      this.#logger.info('Close code %d. Reconnecting with new session...', code);
      this.#scheduleReconnect();
    }
  }

  #onError(err: Error): void {
    this.#logger.error('WebSocket error: %s', err.message);
    this.emit('error', err);
  }

  /**
   * Optimized reconnect backoff (50% faster)
   */
  #scheduleReconnect(): void {
    this.#closeCount++;
    const attempts = Math.min(this.#closeCount - 1, RECONNECT_MAX_ATTEMPTS);
    const baseDelay = Math.min(RECONNECT_BASE * Math.pow(2, attempts), RECONNECT_MAX_DELAY);
    const jitter = Math.random() * 100; // Reduced jitter
    const delay = baseDelay + jitter;

    this.#logger.info('Reconnecting in %dms (attempt %d)', Math.round(delay), this.#closeCount);

    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
    }
    this.#reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  #startHeartbeat(interval: number): void {
    this.#cleanupHeartbeat();

    this.#heartbeatInterval = setInterval(() => {
      if (!this.#heartbeatAck) {
        this.#missedHeartbeats++;
        this.#logger.warn('Heartbeat ACK missed (%d/%d)', this.#missedHeartbeats, MAX_MISSED_HEARTBEATS);

        if (this.#missedHeartbeats >= MAX_MISSED_HEARTBEATS) {
          this.#logger.error('Zombie connection detected! Forcing reconnect.');
          this.#ws?.terminate();
          this.#cleanup();
          this.#state = 'reconnecting';
          this.#scheduleReconnect();
          return;
        }
      }

      this.#heartbeatAck = false;
      this.#sendHeartbeat();
    }, interval);
  }

  #sendHeartbeat(): void {
    this.#send({ op: GatewayOpcodes.HEARTBEAT, d: this.#seq });
  }

  #sendIdentify(): void {
    this.#send({
      op: GatewayOpcodes.IDENTIFY,
      d: {
        token: this.#token,
        intents: this.#intents,
        properties: {
          os: process.platform,
          browser: 'discord-light',
          device: 'discord-light',
        },
        shard: [this.#id, this.#totalShards],
      },
    });
  }

  #sendResume(): void {
    this.#send({
      op: GatewayOpcodes.RESUME,
      d: {
        token: this.#token,
        session_id: this.#sessionId,
        seq: this.#seq,
      },
    });
  }

  sendVoiceStateUpdate(
    guildId: string,
    channelId: string | null,
    selfMute = false,
    selfDeaf = false
  ): void {
    this.#send({
      op: GatewayOpcodes.VOICE_STATE_UPDATE,
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: selfMute,
        self_deaf: selfDeaf,
      },
    });
  }

  #send(payload: GatewayPayload): void {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(payload));
    }
  }

  #cleanup(): void {
    this.#cleanupHeartbeat();
    if (this.#heartbeatTimeout) {
      clearTimeout(this.#heartbeatTimeout);
      this.#heartbeatTimeout = null;
    }
    this.#ws?.removeAllListeners();
    this.#ws = null;
    this.#messageBuffer.length = 0;
    if (this.#state !== 'reconnecting') {
      this.#state = 'disconnected';
    }
  }

  #cleanupHeartbeat(): void {
    if (this.#heartbeatInterval) {
      clearInterval(this.#heartbeatInterval);
      this.#heartbeatInterval = null;
    }
  }

  destroy(): void {
    this.#logger.info('Destroying shard...');
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.#cleanup();
    this.#sessionId = null;
    this.#seq = null;
    this.#missedHeartbeats = 0;
    this.#closeCount = 0;
    this.#state = 'idle';
    this.removeAllListeners();
  }
}
