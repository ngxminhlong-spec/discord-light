import { EventEmitter } from 'node:events';
import { RestManager } from '../rest/RestManager.js';
import { ShardManager } from '../gateway/ShardManager.js';
import { Collection } from '../utils/Collection.js';
import { User } from '../structures/User.js';
import { Guild } from '../structures/Guild.js';
import { Channel } from '../structures/Channel.js';
import { Message, type MessageData } from '../structures/Message.js';
import { Member, type MemberData } from '../structures/Member.js';
import { Interaction, type InteractionData } from '../interactions/Interaction.js';
import { CommandHandler, type Command } from '../interactions/CommandHandler.js';
import { VoiceConnection } from '../voice/VoiceConnection.js';
import { Intents, type IntentKey } from '../utils/Constants.js';
import { Logger, LogLevel } from '../utils/Logger.js';

export interface CacheOptions {
  users?: boolean;
  guilds?: boolean;
  channels?: boolean;
  members?: boolean;
  messages?: boolean;
  sweepInterval?: number;
  sweepTTL?: number;
  maxCacheSize?: number; // New: limit cache size
}

export interface ClientOptions {
  token: string;
  intents?: number | IntentKey[];
  shardCount?: number;
  cache?: CacheOptions;
  logLevel?: LogLevel;
  presence?: {
    status?: 'online' | 'dnd' | 'idle' | 'invisible' | 'offline';
    activities?: Array<{
      name: string;
      type: number;
      url?: string;
    }>;
  };
}

// Event aliases mapping
const EventAliases: Record<string, string> = {
  MESSAGE_CREATE: 'message',
  MESSAGE_UPDATE: 'messageUpdate',
  MESSAGE_DELETE: 'messageDelete',
  MESSAGE_DELETE_BULK: 'messageDeleteBulk',
  GUILD_CREATE: 'guildCreate',
  GUILD_UPDATE: 'guildUpdate',
  GUILD_DELETE: 'guildDelete',
  GUILD_MEMBER_ADD: 'memberJoin',
  GUILD_MEMBER_REMOVE: 'memberLeave',
  GUILD_MEMBER_UPDATE: 'memberUpdate',
  GUILD_MEMBERS_CHUNK: 'membersChunk',
  GUILD_ROLE_CREATE: 'roleCreate',
  GUILD_ROLE_UPDATE: 'roleUpdate',
  GUILD_ROLE_DELETE: 'roleDelete',
  GUILD_BAN_ADD: 'banAdd',
  GUILD_BAN_REMOVE: 'banRemove',
  GUILD_EMOJIS_UPDATE: 'emojisUpdate',
  GUILD_STICKERS_UPDATE: 'stickersUpdate',
  GUILD_INTEGRATIONS_UPDATE: 'integrationsUpdate',
  CHANNEL_CREATE: 'channelCreate',
  CHANNEL_UPDATE: 'channelUpdate',
  CHANNEL_DELETE: 'channelDelete',
  CHANNEL_PINS_UPDATE: 'channelPinsUpdate',
  THREAD_CREATE: 'threadCreate',
  THREAD_UPDATE: 'threadUpdate',
  THREAD_DELETE: 'threadDelete',
  THREAD_LIST_SYNC: 'threadListSync',
  THREAD_MEMBER_UPDATE: 'threadMemberUpdate',
  THREAD_MEMBERS_UPDATE: 'threadMembersUpdate',
  INTERACTION_CREATE: 'interaction',
  VOICE_STATE_UPDATE: 'voiceStateUpdate',
  VOICE_SERVER_UPDATE: 'voiceServerUpdate',
  PRESENCE_UPDATE: 'presenceUpdate',
  TYPING_START: 'typingStart',
  USER_UPDATE: 'userUpdate',
  INVITE_CREATE: 'inviteCreate',
  INVITE_DELETE: 'inviteDelete',
  STAGE_INSTANCE_CREATE: 'stageInstanceCreate',
  STAGE_INSTANCE_UPDATE: 'stageInstanceUpdate',
  STAGE_INSTANCE_DELETE: 'stageInstanceDelete',
  WEBHOOKS_UPDATE: 'webhooksUpdate',
  ENTITLEMENT_CREATE: 'entitlementCreate',
  ENTITLEMENT_UPDATE: 'entitlementUpdate',
  ENTITLEMENT_DELETE: 'entitlementDelete',
  MESSAGE_REACTION_ADD: 'reactionAdd',
  MESSAGE_REACTION_REMOVE: 'reactionRemove',
  MESSAGE_REACTION_REMOVE_ALL: 'reactionRemoveAll',
  MESSAGE_REACTION_REMOVE_EMOJI: 'reactionRemoveEmoji',
  GUILD_SCHEDULED_EVENT_CREATE: 'scheduledEventCreate',
  GUILD_SCHEDULED_EVENT_UPDATE: 'scheduledEventUpdate',
  GUILD_SCHEDULED_EVENT_DELETE: 'scheduledEventDelete',
  GUILD_SCHEDULED_EVENT_USER_ADD: 'scheduledEventUserAdd',
  GUILD_SCHEDULED_EVENT_USER_REMOVE: 'scheduledEventUserRemove',
  AUTO_MODERATION_RULE_CREATE: 'autoModerationRuleCreate',
  AUTO_MODERATION_RULE_UPDATE: 'autoModerationRuleUpdate',
  AUTO_MODERATION_RULE_DELETE: 'autoModerationRuleDelete',
  AUTO_MODERATION_ACTION_EXECUTION: 'autoModerationActionExecution',
};

// Cache for privileged intents
const PRIVILEGED_INTENTS = [
  1 << 0,  // GUILD_MEMBERS
  1 << 8,  // GUILD_PRESENCES  
  1 << 15, // MESSAGE_CONTENT
];

export class Client extends EventEmitter {
  #options: ClientOptions;
  #rest: RestManager;
  #shardManager: ShardManager | null = null;
  #user: User | null = null;
  #guilds: Collection<string, Guild> = new Collection();
  #channels: Collection<string, Channel> = new Collection();
  #users: Collection<string, User> = new Collection();
  #members: Collection<string, Member> = new Collection();
  #messages: Collection<string, Message> = new Collection();
  #voiceConnections: Collection<string, VoiceConnection> = new Collection();
  #commands: CommandHandler;
  #logger: Logger;
  #ready = false;
  #sweepTimer: NodeJS.Timeout | null = null;
  #dispatchQueue: Array<{ event: string; data: unknown }> = [];
  #isProcessingDispatch = false;

  constructor(options: ClientOptions) {
    super();
    this.#options = options;
    this.#rest = new RestManager(this, options.token);
    this.#commands = new CommandHandler(this);
    this.#logger = new Logger(options.logLevel ?? LogLevel.INFO, 'Client');
  }

  get options(): ClientOptions {
    return this.#options;
  }

  get rest(): RestManager {
    return this.#rest;
  }

  get commands(): CommandHandler {
    return this.#commands;
  }

  get shardManager(): ShardManager | null {
    return this.#shardManager;
  }

  get user(): User | null {
    return this.#user;
  }

  get guilds(): Collection<string, Guild> {
    return this.#guilds;
  }

  get channels(): Collection<string, Channel> {
    return this.#channels;
  }

  get users(): Collection<string, User> {
    return this.#users;
  }

  get members(): Collection<string, Member> {
    return this.#members;
  }

  get messages(): Collection<string, Message> {
    return this.#messages;
  }

  get voiceConnections(): Collection<string, VoiceConnection> {
    return this.#voiceConnections;
  }

  get ready(): boolean {
    return this.#ready;
  }

  get logger(): Logger {
    return this.#logger;
  }

  async login(): Promise<string> {
    this.#validateToken();

    const intents = this.#resolveIntents();
    this.#logger.info('Resolved intents: %d', intents);

    const gatewayData = await this.#rest.get<{
      url: string;
      shards: number;
      session_start_limit: {
        total: number;
        remaining: number;
        reset_after: number;
        max_concurrency: number;
      };
    }>('/gateway/bot');

    this.#logger.info(
      'Gateway info: %d shards available, %d remaining sessions',
      gatewayData.shards,
      gatewayData.session_start_limit.remaining
    );

    if (gatewayData.session_start_limit.remaining === 0) {
      throw new Error(
        `Session start limit reached. Resets in ${gatewayData.session_start_limit.reset_after}ms`
      );
    }

    const shardCount = this.#options.shardCount ?? gatewayData.shards;
    this.#shardManager = new ShardManager(
      this,
      this.#options.token,
      intents,
      shardCount,
      gatewayData.url
    );

    this.#shardManager.on(
      'shardReady',
      (
        _shardId: number,
        data: {
          user: { id: string; username: string; discriminator: string; avatar: string | null };
        }
      ) => {
        if (!this.#user) {
          this.#user = new User(data.user);
          this.#users.set(this.#user.id, this.#user);
        }
      }
    );

    this.#shardManager.on('allShardsReady', () => {
      this.#ready = true;
      this.#logger.info('All shards ready! Logged in as %s', this.#user?.tag);
      this.emit('ready');
    });

    this.#shardManager.on('dispatch', (_shardId: number, event: string, data: unknown) => {
      // Queue dispatch events for batch processing
      this.#dispatchQueue.push({ event, data });
      if (!this.#isProcessingDispatch) {
        this.#isProcessingDispatch = true;
        setImmediate(() => this.#processDispatchQueue());
      }
    });

    this.#shardManager.on('shardError', (shardId: number, err: Error) => {
      this.#logger.error('Shard %d error: %s', shardId, err.message);
      this.emit('error', err);
    });

    this.#shardManager.on('shardFatal', (shardId: number, code: number, reason: string) => {
      this.#logger.error('Shard %d fatal: %d %s', shardId, code, reason);
      this.emit('shardFatal', shardId, code, reason);
    });

    this.#setupCacheSweep();
    await this.#shardManager.spawn();
    return this.#options.token;
  }

  async destroy(): Promise<void> {
    this.#logger.info('Destroying client...');
    this.#ready = false;

    if (this.#sweepTimer) {
      clearInterval(this.#sweepTimer);
      this.#sweepTimer = null;
    }

    for (const conn of this.#voiceConnections.values()) {
      conn.disconnect();
    }
    this.#voiceConnections.clear();

    this.#shardManager?.destroy();
    this.#shardManager = null;
    this.#guilds.clear();
    this.#channels.clear();
    this.#users.clear();
    this.#members.clear();
    this.#messages.clear();
    this.#user = null;
  }

  joinVoiceChannel(guildId: string, channelId: string): VoiceConnection {
    const existing = this.#voiceConnections.get(guildId);
    if (existing) {
      if (existing.channelId === channelId) return existing;
      existing.disconnect();
    }

    const connection = new VoiceConnection(this, guildId, channelId);
    this.#voiceConnections.set(guildId, connection);

    connection.on('ready', () => this.emit('voiceConnectionReady', connection));
    connection.on('error', (err: Error) => this.emit('error', err));
    connection.on('close', () => {
      this.#voiceConnections.delete(guildId);
      this.emit('voiceConnectionDisconnect', connection);
    });

    connection.connect().catch((err: Error) => this.emit('error', err));
    return connection;
  }

  leaveVoiceChannel(guildId: string): void {
    this.#voiceConnections.get(guildId)?.disconnect();
  }

  #validateToken(): void {
    const token = this.#options.token;

    if (!token || token.length < 20) {
      throw new Error('Invalid token: Token appears to be too short.');
    }

    if (
      !token.startsWith('Bot ') &&
      !token.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    ) {
      this.#logger.warn(
        'Token does not appear to be a standard Discord Bot token. Ensure you are using a Bot token from the Discord Developer Portal.'
      );
    }

    if (token.startsWith('Bot ')) {
      this.#options.token = token.slice(4);
      this.#logger.info('Stripped "Bot " prefix from token');
    }

    this.#logger.info('Token format validated');
  }

  #resolveIntents(): number {
    const intents = this.#options.intents;
    if (typeof intents === 'number') {
      this.#validateIntents(intents);
      return intents;
    }
    if (Array.isArray(intents)) {
      const resolved = intents.reduce((acc, intent) => acc | (Intents[intent] ?? 0), 0);
      this.#validateIntents(resolved);
      return resolved;
    }
    const defaultIntents =
      Intents.GUILDS |
      Intents.GUILD_MESSAGES |
      Intents.GUILD_VOICE_STATES |
      Intents.GUILD_MESSAGE_REACTIONS |
      Intents.DIRECT_MESSAGES |
      Intents.DIRECT_MESSAGE_REACTIONS;
    this.#logger.info('Using default non-privileged intents: %d', defaultIntents);
    return defaultIntents;
  }

  #validateIntents(intents: number): void {
    const requestedPrivileged = PRIVILEGED_INTENTS.filter(p => (intents & p) === p);

    if (requestedPrivileged.length > 0) {
      this.#logger.warn(
        'Privileged intents requested: %s. Ensure these are enabled in the Discord Developer Portal.',
        requestedPrivileged
          .map(p => {
            const entry = Object.entries(Intents).find(([, v]) => v === p);
            return entry?.[0] ?? String(p);
          })
          .join(', ')
      );
    }
  }

  #setupCacheSweep(): void {
    const cache = this.#options.cache;
    if (!cache?.sweepInterval || !cache?.sweepTTL) return;

    this.#logger.info(
      'Cache sweep enabled: interval=%dms, TTL=%dms',
      cache.sweepInterval,
      cache.sweepTTL
    );

    this.#sweepTimer = setInterval(() => {
      const now = Date.now();
      let total = 0;

      if (cache.users !== false) {
        total += this.#users.sweepByTTL(cache.sweepTTL, now);
      }
      if (cache.members !== false) {
        total += this.#members.sweepByTTL(cache.sweepTTL, now);
      }
      if (cache.messages !== false) {
        total += this.#messages.sweepByTTL(cache.sweepTTL, now);
      }
      if (cache.channels !== false) {
        total += this.#channels.sweepByTTL(cache.sweepTTL, now);
      }
      if (cache.guilds !== false) {
        total += this.#guilds.sweepByTTL(cache.sweepTTL, now);
      }

      if (total > 0) {
        this.#logger.debug('Cache sweep removed %d stale entries', total);
      }
    }, cache.sweepInterval);
  }

  /**
   * Batch process dispatch events to reduce event loop pressure
   */
  #processDispatchQueue(): void {
    const batch = this.#dispatchQueue.splice(0, 50); // Process up to 50 events per batch
    for (const { event, data } of batch) {
      this.#handleDispatch(event, data);
    }

    this.#isProcessingDispatch = false;

    // Schedule next batch if queue is not empty
    if (this.#dispatchQueue.length > 0) {
      this.#isProcessingDispatch = true;
      setImmediate(() => this.#processDispatchQueue());
    }
  }

  #emitAliased(event: string, ...args: unknown[]): void {
    this.emit(event, ...args);
    const alias = EventAliases[event];
    if (alias && alias !== event) {
      this.emit(alias, ...args);
    }
  }

  #handleDispatch(event: string, data: unknown): void {
    switch (event) {
      case 'GUILD_CREATE': {
        const guildData = data as {
          id: string;
          channels?: Array<Record<string, unknown>>;
          members?: Array<Record<string, unknown>>;
          roles?: Array<Record<string, unknown>>;
        };
        if (this.#options.cache?.guilds !== false) {
          const guild = new Guild(this, guildData as Parameters<typeof Guild>[0]);
          this.#guilds.set(guild.id, guild);

          if (guildData.channels) {
            for (const ch of guildData.channels) {
              if (this.#options.cache?.channels !== false) {
                const channel = new Channel(this, ch as Parameters<typeof Channel>[0]);
                this.#channels.set(channel.id, channel);
                guild.channels.set(channel.id, channel);
              }
            }
          }

          if (guildData.members) {
            for (const m of guildData.members) {
              if (this.#options.cache?.members !== false && m.user) {
                const member = new Member(
                  this,
                  { ...m, guild_id: guild.id } as MemberData
                );
                this.#members.set(`${guild.id}-${member.userId}`, member);
                guild.members.set(member.userId!, member);
              }
            }
          }

          if (guildData.roles) {
            for (const r of guildData.roles) {
              import('./Role.js').then(({ Role: RoleClass }) => {
                const role = new RoleClass(
                  this,
                  { ...r, guild_id: guild.id } as Parameters<typeof RoleClass>[1]
                );
                guild.roles.set(role.id, role);
              }).catch(err => this.#logger.error('Failed to load Role class: %s', err.message));
            }
          }

          this.#emitAliased('GUILD_CREATE', guild);
        }
        break;
      }

      case 'GUILD_UPDATE': {
        const guildData = data as { id: string };
        const guild = this.#guilds.get(guildData.id);
        if (guild) {
          guild.patch(guildData as Parameters<typeof Guild>[0]);
          this.#emitAliased('GUILD_UPDATE', guild);
        }
        break;
      }

      case 'GUILD_DELETE': {
        const guildData = data as { id: string; unavailable?: boolean };
        const guild = this.#guilds.get(guildData.id);
        if (guild) {
          this.#guilds.delete(guildData.id);
          if (!guildData.unavailable) {
            this.#emitAliased('GUILD_DELETE', guild);
          } else {
            this.#emitAliased('GUILD_DELETE', guild);
            this.emit('guildUnavailable', guild);
          }
        }
        break;
      }

      case 'CHANNEL_CREATE': {
        const chData = data as { id: string; guild_id?: string };
        if (this.#options.cache?.channels !== false) {
          const channel = new Channel(this, chData as Parameters<typeof Channel>[0]);
          this.#channels.set(channel.id, channel);
          const guild = channel.guildId ? this.#guilds.get(channel.guildId) : undefined;
          guild?.channels.set(channel.id, channel);
          this.#emitAliased('CHANNEL_CREATE', channel);
        }
        break;
      }

      case 'CHANNEL_UPDATE': {
        const chData = data as { id: string };
        const channel = this.#channels.get(chData.id);
        if (channel) {
          channel.patch(chData as Parameters<typeof Channel>[0]);
          this.#emitAliased('CHANNEL_UPDATE', channel);
        }
        break;
      }

      case 'CHANNEL_DELETE': {
        const chData = data as { id: string; guild_id?: string };
        const channel = this.#channels.get(chData.id);
        if (channel) {
          this.#channels.delete(chData.id);
          const guild = chData.guild_id ? this.#guilds.get(chData.guild_id) : undefined;
          guild?.channels.delete(chData.id);
          this.#emitAliased('CHANNEL_DELETE', channel);
        }
        break;
      }

      case 'MESSAGE_CREATE': {
        const msgData = data as MessageData;
        const message = new Message(this, msgData);

        if (this.#options.cache?.messages !== false) {
          this.#messages.set(message.id, message);
        }

        if (this.#options.cache?.users !== false && !this.#users.has(msgData.author.id)) {
          this.#users.set(msgData.author.id, new User(msgData.author));
        }

        this.#emitAliased('MESSAGE_CREATE', message);
        break;
      }

      case 'MESSAGE_UPDATE': {
        const msgData = data as MessageData;
        const existing = this.#messages.get(msgData.id);
        if (existing) {
          existing.patch(msgData);
          this.#emitAliased('MESSAGE_UPDATE', existing, msgData);
        } else {
          this.#emitAliased('MESSAGE_UPDATE', null, msgData);
        }
        break;
      }

      case 'MESSAGE_DELETE': {
        const msgData = data as { id: string; channel_id: string; guild_id?: string };
        const message = this.#messages.get(msgData.id);
        this.#messages.delete(msgData.id);
        this.#emitAliased('MESSAGE_DELETE', message ?? msgData);
        break;
      }

      case 'GUILD_MEMBER_ADD': {
        const mData = data as MemberData & { guild_id: string };
        if (this.#options.cache?.members !== false && mData.user) {
          const member = new Member(this, mData);
          this.#members.set(`${mData.guild_id}-${mData.user.id}`, member);
          const guild = this.#guilds.get(mData.guild_id);
          guild?.members.set(mData.user.id, member);
        }
        this.#emitAliased('GUILD_MEMBER_ADD', mData);
        break;
      }

      case 'GUILD_MEMBER_REMOVE': {
        const mData = data as { guild_id: string; user: { id: string } };
        this.#members.delete(`${mData.guild_id}-${mData.user.id}`);
        const guild = this.#guilds.get(mData.guild_id);
        guild?.members.delete(mData.user.id);
        this.#emitAliased('GUILD_MEMBER_REMOVE', mData);
        break;
      }

      case 'GUILD_MEMBER_UPDATE': {
        const mData = data as MemberData & { guild_id: string };
        const key = `${mData.guild_id}-${mData.user?.id}`;
        const existing = this.#members.get(key);
        if (existing) {
          existing.patch(mData);
          this.#emitAliased('GUILD_MEMBER_UPDATE', existing);
        }
        break;
      }

      case 'VOICE_STATE_UPDATE': {
        this.#emitAliased('VOICE_STATE_UPDATE', data);
        break;
      }

      case 'VOICE_SERVER_UPDATE': {
        this.#emitAliased('VOICE_SERVER_UPDATE', data);
        break;
      }

      case 'INTERACTION_CREATE': {
        const interaction = new Interaction(this, data as InteractionData);

        if (interaction.isCommand) {
          void this.#commands.handle(interaction);
        } else if (interaction.isComponent) {
          this.emit('interactionComponent', interaction);
        } else if (interaction.isModalSubmit) {
          this.emit('interactionModalSubmit', interaction);
        } else if (interaction.isAutocomplete) {
          this.emit('interactionAutocomplete', interaction);
        }

        this.#emitAliased('INTERACTION_CREATE', interaction);
        break;
      }

      case 'PRESENCE_UPDATE': {
        this.#emitAliased('PRESENCE_UPDATE', data);
        break;
      }

      case 'TYPING_START': {
        this.#emitAliased('TYPING_START', data);
        break;
      }

      case 'USER_UPDATE': {
        const uData = data as { id: string };
        const user = this.#users.get(uData.id);
        if (user) {
          user.patch(uData as Parameters<typeof User>[0]);
          if (uData.id === this.#user?.id) {
            this.#user.patch(uData as Parameters<typeof User>[0]);
          }
          this.#emitAliased('USER_UPDATE', user);
        }
        break;
      }

      case 'GUILD_ROLE_CREATE': {
        const rData = data as { guild_id: string; role: Record<string, unknown> };
        const guild = this.#guilds.get(rData.guild_id);
        if (guild) {
          import('./Role.js').then(({ Role: RoleClass }) => {
            const role = new RoleClass(
              this,
              { ...rData.role, guild_id: rData.guild_id } as Parameters<typeof RoleClass>[1]
            );
            guild.roles.set(role.id, role);
            this.#emitAliased('GUILD_ROLE_CREATE', role);
          }).catch(err => this.#logger.error('Failed to load Role class: %s', err.message));
        }
        break;
      }

      case 'GUILD_ROLE_UPDATE': {
        const rData = data as { guild_id: string; role: { id: string } };
        const guild = this.#guilds.get(rData.guild_id);
        if (guild) {
          const role = guild.roles.get(rData.role.id);
          if (role) {
            role.patch(rData.role as Parameters<typeof Role>[0]);
            this.#emitAliased('GUILD_ROLE_UPDATE', role);
          }
        }
        break;
      }

      case 'GUILD_ROLE_DELETE': {
        const rData = data as { guild_id: string; role_id: string };
        const guild = this.#guilds.get(rData.guild_id);
        if (guild) {
          const role = guild.roles.get(rData.role_id);
          guild.roles.delete(rData.role_id);
          this.#emitAliased('GUILD_ROLE_DELETE', role ?? rData);
        }
        break;
      }

      case 'MESSAGE_REACTION_ADD': {
        this.#emitAliased('MESSAGE_REACTION_ADD', data);
        break;
      }

      case 'MESSAGE_REACTION_REMOVE': {
        this.#emitAliased('MESSAGE_REACTION_REMOVE', data);
        break;
      }

      case 'MESSAGE_REACTION_REMOVE_ALL': {
        this.#emitAliased('MESSAGE_REACTION_REMOVE_ALL', data);
        break;
      }

      case 'INVITE_CREATE': {
        this.#emitAliased('INVITE_CREATE', data);
        break;
      }

      case 'INVITE_DELETE': {
        this.#emitAliased('INVITE_DELETE', data);
        break;
      }

      case 'WEBHOOKS_UPDATE': {
        this.#emitAliased('WEBHOOKS_UPDATE', data);
        break;
      }
    }
  }
}
