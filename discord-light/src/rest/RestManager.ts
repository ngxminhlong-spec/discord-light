import https from 'node:https';
import { URL } from 'node:url';
import { EventEmitter } from 'node:events';
import { Bucket, type QueuedRequest, type RateLimitData } from './Bucket.js';
import { Logger, LogLevel } from '../utils/Logger.js';
import { BASE_URL, HTTP_STATUS } from '../utils/Constants.js';
import type { Client } from '../client/Client.js';

export interface RequestOptions {
  method?: string;
  body?: Record<string, unknown> | unknown[];
  headers?: Record<string, string>;
  reason?: string;
  retries?: number;
}

interface DiscordAPIError {
  code: number;
  message: string;
  errors?: unknown;
}

export class RestManager extends EventEmitter {
  #token: string;
  #client: Client;
  #logger: Logger;
  #buckets: Map<string, Bucket> = new Map();
  #globalReset = 0;
  #userAgent = 'DiscordLight (https://github.com/discord-light, 2.0.0)';

  constructor(client: Client, token: string) {
    super();
    this.#client = client;
    this.#token = token;
    this.#logger = new Logger(LogLevel.INFO, 'REST');
  }

  get authHeader(): string {
    return `Bot ${this.#token}`;
  }

  setLogLevel(level: LogLevel): void {
    this.#logger.setLevel(level);
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const bucketId = this.#getBucketId(endpoint, method);
    const bucket = this.#getBucket(bucketId);

    return new Promise<T>((resolve, reject) => {
      const queued: QueuedRequest = {
        resolve: resolve as (value: unknown) => void,
        reject,
        retries: options.retries ?? 0,
        execute: async () => {
          return this.#executeRequest<T>(endpoint, method, options, bucket);
        },
      };
      bucket.add(queued);
    });
  }

  async #executeRequest<T>(
    endpoint: string,
    method: string,
    options: RequestOptions,
    bucket: Bucket
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const body = options.body ? JSON.stringify(options.body) : undefined;

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      'User-Agent': this.#userAgent,
      ...options.headers,
    };

    if (options.reason) {
      headers['X-Audit-Log-Reason'] = encodeURIComponent(options.reason);
    }

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body).toString();
    }

    this.#logger.debug('%s %s | Bucket: %s', method, endpoint, bucket.id);

    const response = await this.#makeRequest(url, method, headers, body);

    // Parse rate limit headers
    const limit = response.headers['x-ratelimit-limit'];
    const remaining = response.headers['x-ratelimit-remaining'];
    const reset = response.headers['x-ratelimit-reset'];
    const resetAfter = response.headers['x-ratelimit-reset-after'];
    const bucketHeader = response.headers['x-ratelimit-bucket'];

    if (limit && remaining && reset) {
      const rateData: RateLimitData = {
        limit: parseInt(limit as string),
        remaining: parseInt(remaining as string),
        reset: parseFloat(reset as string) * 1000,
        resetAfter: parseFloat(resetAfter as string || '0') * 1000,
        bucket: (bucketHeader as string) || bucket.id,
      };
      bucket.updateRateLimit(rateData);
    }

    // Handle 429 Rate Limited
    if (response.statusCode === HTTP_STATUS.TOO_MANY_REQUESTS) {
      const retryAfter = parseFloat(response.headers['retry-after'] as string || '1') * 1000;
      const isGlobal = response.headers['x-ratelimit-global'] === 'true';

      if (isGlobal) {
        this.#globalReset = Date.now() + retryAfter;
        bucket.setGlobalReset(this.#globalReset);
        this.#logger.warn('Global rate limit hit. Waiting %dms', retryAfter);
      } else {
        this.#logger.warn('Bucket %s rate limited. Waiting %dms', bucket.id, retryAfter);
      }

      const maxRetries = 3;
      const currentRetries = options.retries ?? 0;
      if (currentRetries < maxRetries) {
        const jitter = Math.random() * 1000;
        const backoff = Math.min(1000 * Math.pow(2, currentRetries) + jitter, 30000);
        await sleep(backoff);
        return this.request<T>(endpoint, { ...options, retries: currentRetries + 1 });
      }

      throw new DiscordAPIError(
        429,
        `Rate limited after ${maxRetries} retries on ${method} ${endpoint}`,
        endpoint
      );
    }

    // Handle 5xx Server Errors with exponential backoff
    if (response.statusCode && response.statusCode >= 500) {
      const maxRetries = 3;
      const currentRetries = options.retries ?? 0;
      if (currentRetries < maxRetries) {
        const backoff = Math.min(1000 * Math.pow(2, currentRetries) + Math.random() * 1000, 30000);
        this.#logger.warn('Server error %d on %s %s. Retrying in %dms (attempt %d/%d)',
          response.statusCode, method, endpoint, backoff, currentRetries + 1, maxRetries);
        await sleep(backoff);
        return this.request<T>(endpoint, { ...options, retries: currentRetries + 1 });
      }
      throw new DiscordAPIError(
        response.statusCode,
        `Server error ${response.statusCode} after ${maxRetries} retries on ${method} ${endpoint}`,
        endpoint
      );
    }

    // Handle Discord API errors (4xx)
    if (response.statusCode && response.statusCode >= 400) {
      const data = await this.#parseBody<DiscordAPIError>(response);
      const error = new DiscordAPIError(
        data?.code ?? response.statusCode,
        data?.message ?? `HTTP ${response.statusCode}`,
        endpoint,
        data?.errors
      );
      this.#logger.error('%s', error.message);
      throw error;
    }

    // Success
    if (response.statusCode === HTTP_STATUS.NO_CONTENT) {
      return undefined as T;
    }

    return this.#parseBody<T>(response);
  }

  #makeRequest(
    url: URL,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<https.IncomingMessage> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method,
          headers,
        },
        (res) => resolve(res)
      );

      req.on('error', reject);

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  #parseBody<T>(response: https.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          resolve(undefined as T);
          return;
        }
        try {
          resolve(JSON.parse(buffer.toString()) as T);
        } catch {
          resolve(buffer.toString() as T);
        }
      });
      response.on('error', reject);
    });
  }

  #getBucketId(endpoint: string, method: string): string {
    let normalized = endpoint;

    const channelMatch = endpoint.match(/^\/channels\/(\d+)/);
    const guildMatch = endpoint.match(/^\/guilds\/(\d+)/);
    const webhookMatch = endpoint.match(/^\/webhooks\/(\d+)(?:\/(.+))?/);

    if (channelMatch) {
      normalized = endpoint.replace(channelMatch[1], ':channelId');
    } else if (guildMatch) {
      normalized = endpoint.replace(guildMatch[1], ':guildId');
    } else if (webhookMatch) {
      normalized = endpoint.replace(webhookMatch[1], ':webhookId');
      if (webhookMatch[2]) {
        normalized = normalized.replace(webhookMatch[2], ':webhookToken');
      }
    }

    return `${method}:${normalized}`;
  }

  #getBucket(id: string): Bucket {
    let bucket = this.#buckets.get(id);
    if (!bucket) {
      bucket = new Bucket(id, this.#logger);
      this.#buckets.set(id, bucket);
    }
    return bucket;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  async patch<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  async put<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export class DiscordAPIError extends Error {
  code: number;
  endpoint: string;
  errors?: unknown;

  constructor(code: number, message: string, endpoint: string, errors?: unknown) {
    super(message);
    this.name = 'DiscordAPIError';
    this.code = code;
    this.endpoint = endpoint;
    this.errors = errors;
  }

  get meaning(): string {
    return DiscordErrorMap[this.code] ?? 'Unknown Error';
  }

  get humanReadable(): string {
    return `Discord API Error ${this.code} (${this.meaning}) on ${this.endpoint}: ${this.message}`;
  }
}

export const DiscordErrorMap: Record<number, string> = {
  // General
  0: 'General Error',
  // Unknown
  10001: 'Unknown Account',
  10002: 'Unknown Application',
  10003: 'Unknown Channel',
  10004: 'Unknown Guild',
  10005: 'Unknown Integration',
  10006: 'Unknown Invite',
  10007: 'Unknown Member',
  10008: 'Unknown Message',
  10009: 'Unknown Permission Overwrite',
  10010: 'Unknown Provider',
  10011: 'Unknown Role',
  10013: 'Unknown User',
  10014: 'Unknown Emoji',
  10015: 'Unknown Webhook',
  10016: 'Unknown Webhook Service',
  10020: 'Unknown Session',
  10026: 'Unknown Ban',
  10027: 'Unknown SKU',
  10028: 'Unknown Store Listing',
  10029: 'Unknown Entitlement',
  10030: 'Unknown Build',
  10031: 'Unknown Lobby',
  10032: 'Unknown Branch',
  10033: 'Unknown Store Directory Layout',
  10036: 'Unknown Redistributable',
  10038: 'Unknown Gift Code',
  10049: 'Unknown Stream',
  10050: 'Unknown Premium Server Subscribe Cooldown',
  10057: 'Unknown Guild Template',
  10059: 'Unknown Discoverable Server Category',
  10060: 'Unknown Sticker',
  10062: 'Unknown Interaction',
  10063: 'Unknown Application Command',
  10066: 'Unknown Application Command Permissions',
  10067: 'Unknown Stage Instance',
  10068: 'Unknown Guild Member Verification Form',
  10069: 'Unknown Guild Welcome Screen',
  10070: 'Unknown Guild Scheduled Event',
  10071: 'Unknown Guild Scheduled Event User',
  10087: 'Unknown Tag',
  // User
  20001: 'Bots cannot use this endpoint',
  20002: 'Only bots can use this endpoint',
  20009: 'Explicit content cannot be sent to the desired recipient(s)',
  20012: 'You are not authorized to perform this action on this application',
  20016: 'Slowmode rate limit',
  20018: 'Only owners can use this command',
  20022: 'This message cannot be edited due to announcement rate limits',
  20024: 'Under minimum age',
  20028: 'The channel you are writing has hit the write rate limit',
  20029: 'The write action you are performing on the server has hit the write rate limit',
  20031: 'Your Stage topic, server name, server description, or channel names contain words that are not allowed',
  20035: 'Guild premium subscription level too low',
  // Access
  30001: 'Maximum number of guilds reached (100)',
  30002: 'Maximum number of friends reached (1000)',
  30003: 'Maximum number of pins reached for the channel (50)',
  30004: 'Maximum number of recipients reached (10)',
  30005: 'Maximum number of guild roles reached (250)',
  30007: 'Maximum number of webhooks reached (15)',
  30008: 'Maximum number of emojis reached',
  30010: 'Maximum number of reactions reached (20)',
  30011: 'Maximum number of group DMs reached (10)',
  30013: 'Maximum number of guild channels reached (500)',
  30015: 'Maximum number of attachments in a message reached (10)',
  30016: 'Maximum number of invites reached (1000)',
  30018: 'Maximum number of animated emojis reached',
  30019: 'Maximum number of server members reached',
  30030: 'Maximum number of server categories reached (5)',
  30031: 'Guild already has a template',
  30032: 'Maximum number of application commands reached',
  30033: 'Max number of thread participants reached (1000)',
  30034: 'Maximum number of daily application command creates reached (200)',
  30035: 'Maximum number of bans for non-guild members have been exceeded',
  30037: 'Maximum number of bans fetches reached',
  30038: 'Maximum number of uncompleted guild scheduled events reached (100)',
  30039: 'Maximum number of stickers reached',
  30040: 'Maximum number of prune requests has been reached. Try again later',
  30042: 'Maximum number of guild widget settings updates has been reached. Try again later',
  30044: 'Maximum number of edits to messages older than 1 hour reached. Try again later',
  30045: 'Maximum number of pinned threads in a forum channel has been reached',
  30046: 'Maximum number of tags in a forum channel has been reached (5)',
  30047: 'Bitrate is too high for channel of this type',
  30048: 'Maximum number of premium emojis reached (25)',
  30052: 'Maximum number of webhooks per guild reached (1000)',
  30056: 'Maximum number of channel permission overwrites reached (1000)',
  30058: 'The channels for this guild are too large',
  30060: 'Maximum number of webhooks per channel reached (15)',
  // Action
  40001: 'Unauthorized. Provide a valid token and try again',
  40002: 'You need to verify your account in order to perform this action',
  40003: 'You are opening direct messages too fast',
  40004: 'Send messages has been temporarily disabled',
  40005: 'Request entity too large. Try sending something smaller in size',
  40006: 'This feature has been temporarily disabled server-side',
  40007: 'The user is banned from this guild',
  40012: 'Connection has been revoked',
  40032: 'Target user is not connected to voice',
  40033: 'This message has already been crossposted',
  40041: 'An application command with that name already exists',
  40043: 'Application interaction failed to send',
  40058: 'Cannot send a message in a forum channel',
  40060: 'Interaction has already been acknowledged',
  40061: 'Tag names must be unique',
  40062: 'Service resource is being rate limited',
  40066: 'There are no tags available that can be set by non-moderators',
  40067: 'A tag is required to create a forum post in this channel',
  // Access 2
  50001: 'Missing Access',
  50002: 'Invalid Account Type',
  50003: 'Cannot execute action on a DM channel',
  50004: 'Guild widget disabled',
  50005: 'Cannot edit a message authored by another user',
  50006: 'Cannot send an empty message',
  50007: 'Cannot send messages to this user',
  50008: 'Cannot send messages in a non-text channel',
  50009: 'Channel verification level is too high for you to gain access',
  50010: 'OAuth2 application does not have a bot',
  50011: 'OAuth2 application limit reached',
  50012: 'Invalid OAuth2 state',
  50013: 'Missing Permissions',
  50014: 'Invalid authentication token provided',
  50015: 'Note was too long',
  50016: 'Provided too few or too many messages to delete. Must provide at least 2 and fewer than 100 messages to delete',
  50017: 'Invalid MFA Level',
  50019: 'A message can only be pinned to the channel it was sent in',
  50020: 'Invite code was either invalid or taken',
  50021: 'Cannot execute action on a system message',
  50023: 'Invalid OAuth2 access token provided',
  50024: 'Invalid webhook token provided',
  50025: 'Invalid role',
  50026: 'Invalid Recipient(s)',
  50027: 'Invalid phone number',
  50028: 'Invalid form body',
  50029: 'Invalid API version provided',
  50030: 'Invalid guild',
  50031: 'Invalid request origin',
  50032: 'Invalid message type',
  50033: 'Invalid recipient(s)',
  50034: 'Invalid bot token',
  50035: 'Invalid user',
  50036: 'Invalid snowflake',
  50041: 'Invalid avatar',
  50045: 'Invalid file uploaded',
  50046: 'Invalid file',
  50047: 'Cannot self-redeem this gift',
  50054: 'Invalid guild template',
  50055: 'Invalid guild template name',
  50057: 'Invalid guild template description',
  50067: 'Invalid request',
  50068: 'Invalid invite',
  50073: 'Payment source required to redeem gift',
  50074: 'Cannot delete a channel required for Community guilds',
  50080: 'Cannot edit stickers within a message',
  50081: 'Invalid sticker sent',
  50083: 'Tried to perform an operation on an archived thread, such as editing a message or adding a user to the thread',
  50084: 'Invalid thread notification settings',
  50085: 'before value is earlier than the thread creation date',
  50086: 'Community server channels must be text channels',
  50091: 'The entity type of the event is different from the entity you are trying to start the event for',
  50095: 'This server is not available in your location',
  50097: 'This server needs monetization enabled in order to perform this action',
  50101: 'This server needs more boosts to perform this action',
  50109: 'The request body contains invalid JSON',
  50110: 'Owner cannot be pending member',
  50131: 'This server is not available in your location',
  50132: 'This server needs monetization enabled in order to perform this action',
  50138: 'Unable to resize image below the minimum size',
  50144: 'Cannot mix subscription and non subscription roles for an emoji',
  50145: 'Cannot convert between premium emoji and normal emoji',
  50146: 'Uploaded file not found',
  50159: 'Voice messages do not support additional content',
  50160: 'Voice messages must have a single audio attachment',
  50161: 'Voice messages must have supporting metadata',
  50162: 'Voice messages cannot be edited',
  50163: 'Cannot delete guild subscription integration',
  50169: 'You cannot send voice messages in this channel',
  50173: 'You do not have permission to send voice messages in this channel',
  50178: 'The user account must first be verified',
  50195: 'This server needs more boosts to perform this action',
  60003: 'Two factor is required for this operation',
  80004: 'No users with DiscordTag exist',
  90001: 'Reaction was blocked',
  130000: 'API resource is currently overloaded. Try again a little later',
  150006: 'The Stage is already open',
  160002: 'Cannot reply without permission to read message history',
  160004: 'A thread has already been created for this message',
  160005: 'Thread is locked',
  160006: 'Maximum number of active threads reached',
  160007: 'Maximum number of active announcement threads reached',
  170001: 'Invalid JSON for uploaded Lottie file',
  170002: 'Uploaded Lotties cannot contain rasterized images such as PNG or JPEG',
  170003: 'Sticker maximum framerate exceeded',
  170004: 'Sticker frame count exceeds maximum of 1000 frames',
  170005: 'Lottie animation maximum dimensions exceeded',
  170006: 'Sticker frame rate is either too small or too large',
  170007: 'Sticker animation duration exceeds maximum of 5 seconds',
  180000: 'Cannot update a finished event',
  180002: 'Failed to create stage needed for stage event',
  200000: 'Message was blocked by automatic moderation',
  200001: 'Title was blocked by automatic moderation',
  220001: 'Webhooks can only create threads in forum channels',
  220002: 'Webhooks cannot use this endpoint',
  220003: 'Webhook cannot operate on the requested channel',
  240000: 'Message blocked by harmful links filter',
  // OAuth2
  50074: 'Cannot delete a channel required for Community guilds',
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
