import { EventEmitter } from 'node:events';

// ============================================================
// UTILS
// ============================================================

export enum LogLevel {
  ERROR = 0, WARN = 1, INFO = 2, DEBUG = 3,
}

export class Logger {
  constructor(level?: LogLevel, prefix?: string);
  setLevel(level: LogLevel): void;
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export class Collection<K, V> extends Map<K, V> {
  first(): V | undefined;
  firstKey(): K | undefined;
  last(): V | undefined;
  lastKey(): K | undefined;
  filter(predicate: (value: V, key: K, collection: this) => boolean): Collection<K, V>;
  map<T>(mapper: (value: V, key: K, collection: this) => T): T[];
  find(predicate: (value: V, key: K, collection: this) => boolean): V | undefined;
  some(predicate: (value: V, key: K, collection: this) => boolean): boolean;
  every(predicate: (value: V, key: K, collection: this) => boolean): boolean;
  sort(compareFunction: (firstValue: V, secondValue: V, firstKey: K, secondKey: K) => number): Collection<K, V>;
  toArray(): V[];
  random(): V | undefined;
  sweep(filter: (value: V, key: K, collection: this) => boolean): number;
  sweepByTTL<T extends { createdTimestamp: number }>(this: Collection<K, T>, maxAgeMs: number, now?: number): number;
}

export const API_VERSION: number;
export const BASE_URL: string;
export const CDN_URL: string;
export const GATEWAY_VERSION: number;

export const GatewayOpcodes: { DISPATCH: 0; HEARTBEAT: 1; IDENTIFY: 2; PRESENCE_UPDATE: 3; VOICE_STATE_UPDATE: 4; VOICE_SERVER_PING: 5; RESUME: 6; RECONNECT: 7; REQUEST_GUILD_MEMBERS: 8; INVALID_SESSION: 9; HELLO: 10; HEARTBEAT_ACK: 11; };
export const VoiceOpcodes: { IDENTIFY: 0; SELECT_PROTOCOL: 1; READY: 2; HEARTBEAT: 3; SESSION_DESCRIPTION: 4; SPEAKING: 5; HEARTBEAT_ACK: 6; RESUME: 7; HELLO: 8; RESUMED: 9; CLIENT_DISCONNECT: 13; };
export const GatewayCloseCodes: { UNKNOWN_ERROR: 4000; UNKNOWN_OPCODE: 4001; DECODE_ERROR: 4002; NOT_AUTHENTICATED: 4003; AUTHENTICATION_FAILED: 4004; ALREADY_AUTHENTICATED: 4005; INVALID_SEQ: 4007; RATE_LIMITED: 4008; SESSION_TIMED_OUT: 4009; INVALID_SHARD: 4010; SHARDING_REQUIRED: 4011; INVALID_API_VERSION: 4012; INVALID_INTENTS: 4013; DISALLOWED_INTENTS: 4014; };
export const ResumeableCloseCodes: number[];
export const FatalCloseCodes: number[];

export const Intents: { GUILDS: number; GUILD_MEMBERS: number; GUILD_MODERATION: number; GUILD_EMOJIS_AND_STICKERS: number; GUILD_INTEGRATIONS: number; GUILD_WEBHOOKS: number; GUILD_INVITES: number; GUILD_VOICE_STATES: number; GUILD_PRESENCES: number; GUILD_MESSAGES: number; GUILD_MESSAGE_REACTIONS: number; GUILD_MESSAGE_TYPING: number; DIRECT_MESSAGES: number; DIRECT_MESSAGE_REACTIONS: number; DIRECT_MESSAGE_TYPING: number; MESSAGE_CONTENT: number; GUILD_SCHEDULED_EVENTS: number; AUTO_MODERATION_CONFIGURATION: number; AUTO_MODERATION_EXECUTION: number; };
export type IntentKey = keyof typeof Intents;

export enum ChannelType { GUILD_TEXT = 0; DM = 1; GUILD_VOICE = 2; GROUP_DM = 3; GUILD_CATEGORY = 4; GUILD_ANNOUNCEMENT = 5; ANNOUNCEMENT_THREAD = 10; PUBLIC_THREAD = 11; PRIVATE_THREAD = 12; GUILD_STAGE_VOICE = 13; GUILD_DIRECTORY = 14; GUILD_FORUM = 15; GUILD_MEDIA = 16; }
export enum InteractionType { PING = 1; APPLICATION_COMMAND = 2; MESSAGE_COMPONENT = 3; APPLICATION_COMMAND_AUTOCOMPLETE = 4; MODAL_SUBMIT = 5; }
export enum ApplicationCommandType { CHAT_INPUT = 1; USER = 2; MESSAGE = 3; }
export enum MessageComponentType { ACTION_ROW = 1; BUTTON = 2; STRING_SELECT = 3; TEXT_INPUT = 4; USER_SELECT = 5; ROLE_SELECT = 6; MENTIONABLE_SELECT = 7; CHANNEL_SELECT = 8; }
export enum ButtonStyle { PRIMARY = 1; SECONDARY = 2; SUCCESS = 3; DANGER = 4; LINK = 5; }

export const HTTP_STATUS: { OK: 200; CREATED: 201; NO_CONTENT: 204; BAD_REQUEST: 400; UNAUTHORIZED: 401; FORBIDDEN: 403; NOT_FOUND: 404; TOO_MANY_REQUESTS: 429; SERVER_ERROR: 500; };

// ============================================================
// BUILDERS
// ============================================================

export interface EmbedField { name: string; value: string; inline?: boolean; }
export interface EmbedAuthor { name: string; url?: string; icon_url?: string; }
export interface EmbedFooter { text: string; icon_url?: string; }
export interface EmbedImage { url: string; proxy_url?: string; height?: number; width?: number; }
export interface EmbedData { title?: string; type?: string; description?: string; url?: string; timestamp?: string; color?: number; footer?: EmbedFooter; image?: EmbedImage; thumbnail?: EmbedImage; video?: EmbedImage; provider?: { name?: string; url?: string }; author?: EmbedAuthor; fields?: EmbedField[]; }

export class EmbedBuilder {
  static from(data: EmbedData): EmbedBuilder;
  setTitle(title: string): this;
  setDescription(description: string): this;
  setURL(url: string): this;
  setColor(color: number | string | [number, number, number]): this;
  setTimestamp(timestamp?: Date | number | string): this;
  setFooter(options: { text: string; iconURL?: string }): this;
  setImage(url: string): this;
  setThumbnail(url: string): this;
  setAuthor(options: { name: string; url?: string; iconURL?: string }): this;
  addField(field: EmbedField): this;
  addField(name: string, value: string, inline?: boolean): this;
  addFields(...fields: EmbedField[]): this;
  setFields(...fields: EmbedField[]): this;
  spliceFields(index: number, deleteCount: number, ...fields: EmbedField[]): this;
  setVideo(url: string): this;
  setProvider(name: string, url?: string): this;
  get data(): EmbedData;
  toJSON(): EmbedData;
  get length(): number;
  validate(): void;
}

export interface ButtonData { type: MessageComponentType.BUTTON; style: ButtonStyle; label?: string; emoji?: { id?: string; name?: string; animated?: boolean }; custom_id?: string; url?: string; disabled?: boolean; sku_id?: string; }

export class ButtonBuilder {
  static from(data: ButtonData): ButtonBuilder;
  setStyle(style: ButtonStyle): this;
  setLabel(label: string): this;
  setEmoji(emoji: string | { name?: string; id?: string; animated?: boolean }): this;
  setCustomId(id: string): this;
  setURL(url: string): this;
  setDisabled(disabled?: boolean): this;
  setSKUId(skuId: string): this;
  get data(): ButtonData;
  toJSON(): ButtonData;
}

export interface SelectMenuOption { label: string; value: string; description?: string; emoji?: { id?: string; name?: string; animated?: boolean }; default?: boolean; }
export interface SelectMenuData { type: MessageComponentType; custom_id: string; options?: SelectMenuOption[]; channel_types?: number[]; placeholder?: string; default_values?: { id: string; type: string }[]; min_values?: number; max_values?: number; disabled?: boolean; }

export class SelectMenuBuilder {
  constructor(type?: MessageComponentType);
  static from(data: SelectMenuData): SelectMenuBuilder;
  setCustomId(id: string): this;
  setPlaceholder(placeholder: string): this;
  setMinValues(min: number): this;
  setMaxValues(max: number): this;
  setDisabled(disabled?: boolean): this;
  addOptions(...options: SelectMenuOption[]): this;
  setOptions(...options: SelectMenuOption[]): this;
  spliceOptions(index: number, deleteCount: number, ...options: SelectMenuOption[]): this;
  setChannelTypes(...types: number[]): this;
  get data(): SelectMenuData;
  toJSON(): SelectMenuData;
}

export interface ActionRowData { type: MessageComponentType.ACTION_ROW; components: (ButtonData | SelectMenuData | Record<string, unknown>)[]; }

export class ActionRowBuilder {
  static from(data: ActionRowData): ActionRowBuilder;
  addComponents(...components: (ButtonData | SelectMenuData | Record<string, unknown>)[]): this;
  setComponents(...components: (ButtonData | SelectMenuData | Record<string, unknown>)[]): this;
  spliceComponents(index: number, deleteCount: number, ...components: (ButtonData | SelectMenuData | Record<string, unknown>)[]): this;
  get components(): (ButtonData | SelectMenuData | Record<string, unknown>)[];
  get data(): ActionRowData;
  toJSON(): ActionRowData;
}

// ============================================================
// PERMISSIONS
// ============================================================

export const PermissionFlags: Record<string, bigint>;
export type PermissionFlag = keyof typeof PermissionFlags;

export class PermissionsBitField {
  constructor(bits?: bigint | string | number | PermissionsBitField);
  get bitfield(): bigint;
  has(...permissions: PermissionFlag[]): boolean;
  hasAny(...permissions: PermissionFlag[]): boolean;
  missing(...permissions: PermissionFlag[]): PermissionFlag[];
  add(...permissions: PermissionFlag[]): this;
  remove(...permissions: PermissionFlag[]): this;
  toggle(...permissions: PermissionFlag[]): this;
  freeze(): Readonly<PermissionsBitField>;
  serialize(): Record<PermissionFlag, boolean>;
  toArray(): PermissionFlag[];
  toJSON(): string;
  valueOf(): bigint;
  equals(other: PermissionsBitField | bigint | string | number): boolean;
  static resolve(permission: PermissionFlag | bigint | string | number): bigint;
  static all(): PermissionsBitField;
  static default(): PermissionsBitField;
}

// ============================================================
// STRUCTURES
// ============================================================

export interface APIData { id: string; [key: string]: unknown; }

export abstract class Structure<T extends APIData> {
  readonly id: string;
  readonly createdTimestamp: number;
  protected _data: T;
  constructor(data: T);
  get raw(): T;
  patch(data: Partial<T>): void;
}

export interface UserData extends APIData {
  username: string; discriminator: string; avatar: string | null;
  bot?: boolean; system?: boolean; banner?: string | null;
  accent_color?: number | null; global_name?: string | null;
  avatar_decoration_data?: unknown;
}

export class User extends Structure<UserData> {
  get username(): string;
  get globalName(): string | null | undefined;
  get displayName(): string;
  get discriminator(): string;
  get tag(): string;
  get avatar(): string | null;
  get avatarURL(): string | null;
  get defaultAvatarURL(): string;
  get displayAvatarURL(): string;
  get bot(): boolean;
  get system(): boolean;
  get banner(): string | null | undefined;
  get bannerURL(): string | null;
  get accentColor(): number | null | undefined;
  toString(): string;
}

export interface MemberData extends APIData {
  user?: UserData; nick?: string | null; avatar?: string | null;
  roles: string[]; joined_at: string; premium_since?: string | null;
  deaf: boolean; mute: boolean; flags: number; pending?: boolean;
  permissions?: string; communication_disabled_until?: string | null;
  guild_id?: string;
}

export class Member extends Structure<MemberData> {
  constructor(client: Client, data: MemberData);
  get user(): UserData | undefined;
  get userId(): string | undefined;
  get nick(): string | null | undefined;
  get displayName(): string;
  get roles(): string[];
  get joinedTimestamp(): number;
  get deaf(): boolean;
  get mute(): boolean;
  get pending(): boolean;
  get permissions(): PermissionsBitField;
  get guildId(): string | undefined;
  get communicationDisabledUntil(): number | null;
  get isCommunicationDisabled(): boolean;
  get avatar(): string | null | undefined;
  get avatarURL(): string | null;
  get displayAvatarURL(): string | null;
  kick(reason?: string): Promise<void>;
  ban(options?: { deleteMessageSeconds?: number; reason?: string }): Promise<void>;
  timeout(durationMs: number, reason?: string): Promise<Member>;
  removeTimeout(): Promise<Member>;
  addRole(roleId: string, reason?: string): Promise<void>;
  removeRole(roleId: string, reason?: string): Promise<void>;
  setNick(nick: string | null, reason?: string): Promise<Member>;
  deafen(deaf?: boolean, reason?: string): Promise<Member>;
  mute(mute?: boolean, reason?: string): Promise<Member>;
  move(channelId: string | null, reason?: string): Promise<Member>;
  fetch(): Promise<Member>;
  toString(): string;
}

export interface RoleData extends APIData {
  name: string; color: number; hoist: boolean;
  icon?: string | null; unicode_emoji?: string | null;
  position: number; permissions: string; managed: boolean;
  mentionable: boolean; tags?: unknown; flags: number; guild_id?: string;
}

export class Role extends Structure<RoleData> {
  constructor(client: Client, data: RoleData);
  get name(): string;
  get color(): number;
  get hexColor(): string;
  get hoist(): boolean;
  get icon(): string | null | undefined;
  get unicodeEmoji(): string | null | undefined;
  get position(): number;
  get permissions(): PermissionsBitField;
  get managed(): boolean;
  get mentionable(): boolean;
  get guildId(): string | undefined;
  get flags(): number;
  get isPremiumRole(): boolean;
  get isBotRole(): boolean;
  edit(data: Partial<Omit<RoleData, 'id' | 'guild_id'>>): Promise<Role>;
  setName(name: string): Promise<Role>;
  setColor(color: number | string): Promise<Role>;
  setHoist(hoist: boolean): Promise<Role>;
  setMentionable(mentionable: boolean): Promise<Role>;
  setPermissions(permissions: bigint | string | PermissionsBitField): Promise<Role>;
  setPosition(position: number): Promise<Role>;
  delete(reason?: string): Promise<void>;
  toString(): string;
}

export interface ChannelData extends APIData {
  type: ChannelType; guild_id?: string; name?: string;
  topic?: string | null; nsfw?: boolean; last_message_id?: string | null;
  bitrate?: number; user_limit?: number; rate_limit_per_user?: number;
  parent_id?: string | null; position?: number;
  permission_overwrites?: unknown[]; rtc_region?: string | null;
  video_quality_mode?: number; default_auto_archive_duration?: number;
  flags?: number;
}

export class Channel extends Structure<ChannelData> {
  constructor(client: Client, data: ChannelData);
  get type(): ChannelType;
  get name(): string | undefined;
  get guildId(): string | undefined;
  get topic(): string | null | undefined;
  get nsfw(): boolean;
  get lastMessageId(): string | null | undefined;
  get bitrate(): number | undefined;
  get userLimit(): number | undefined;
  get rateLimitPerUser(): number | undefined;
  get parentId(): string | null | undefined;
  get position(): number | undefined;
  get isTextBased(): boolean;
  get isVoiceBased(): boolean;
  get isThread(): boolean;
  get isDM(): boolean;
  get isCategory(): boolean;
  send(content: string | Record<string, unknown>): Promise<Message>;
  edit(data: Partial<Omit<ChannelData, 'id'>>): Promise<Channel>;
  delete(): Promise<void>;
  setName(name: string): Promise<Channel>;
  setTopic(topic: string | null): Promise<Channel>;
  setNSFW(nsfw: boolean): Promise<Channel>;
  setRateLimitPerUser(seconds: number): Promise<Channel>;
  setParent(parentId: string | null): Promise<Channel>;
  setPosition(position: number): Promise<Channel>;
  fetchMessages(options?: { limit?: number; before?: string; after?: string; around?: string }): Promise<Message[]>;
  fetchMessage(messageId: string): Promise<Message>;
  bulkDelete(messageIds: string[], reason?: string): Promise<void>;
  createInvite(options?: Record<string, unknown>): Promise<unknown>;
  fetchInvites(): Promise<unknown>;
  typing(): Promise<void>;
  fetchWebhooks(): Promise<unknown>;
  createWebhook(name: string, avatar?: string | null): Promise<unknown>;
  toString(): string;
}

export interface GuildData extends APIData {
  name: string; icon: string | null; owner_id: string;
  roles: RoleData[]; emojis: unknown[]; features: string[];
  member_count?: number; description?: string | null;
  premium_tier?: number; preferred_locale?: string;
  channels?: Array<Record<string, unknown>>;
  members?: Array<Record<string, unknown>>;
  verification_level?: number; default_message_notifications?: number;
  explicit_content_filter?: number; mfa_level?: number;
  system_channel_id?: string | null; rules_channel_id?: string | null;
  public_updates_channel_id?: string | null; vanity_url_code?: string | null;
  banner?: string | null; splash?: string | null;
  discovery_splash?: string | null; max_members?: number;
  max_presences?: number; max_video_channel_users?: number;
  approximate_member_count?: number; approximate_presence_count?: number;
  nsfw_level?: number; premium_subscription_count?: number;
}

export class Guild extends Structure<GuildData> {
  constructor(client: Client, data: GuildData);
  channels: Collection<string, Channel>;
  members: Collection<string, Member>;
  roles: Collection<string, Role>;
  get name(): string;
  get icon(): string | null;
  get iconURL(): string | null;
  get banner(): string | null | undefined;
  get bannerURL(): string | null;
  get splash(): string | null | undefined;
  get splashURL(): string | null;
  get ownerId(): string;
  get memberCount(): number;
  get approximateMemberCount(): number | undefined;
  get approximatePresenceCount(): number | undefined;
  get description(): string | null | undefined;
  get premiumTier(): number;
  get premiumSubscriptionCount(): number | undefined;
  get features(): string[];
  get preferredLocale(): string;
  get verificationLevel(): number;
  get defaultMessageNotifications(): number;
  get explicitContentFilter(): number;
  get mfaLevel(): number;
  get systemChannelId(): string | null | undefined;
  get rulesChannelId(): string | null | undefined;
  get vanityURLCode(): string | null | undefined;
  get nsfwLevel(): number;
  get maxMembers(): number | undefined;
  get maxPresences(): number | undefined;
  get maxVideoChannelUsers(): number | undefined;
  get isPartnered(): boolean;
  get isVerified(): boolean;
  fetch(): Promise<Guild>;
  edit(data: Partial<Omit<GuildData, 'id'>>): Promise<Guild>;
  leave(): Promise<void>;
  delete(): Promise<void>;
  fetchOwner(): Promise<Member | undefined>;
  fetchMember(userId: string): Promise<Member>;
  fetchRoles(): Promise<Collection<string, Role>>;
  createRole(data: Partial<RoleData>): Promise<Role>;
  prune(days: number, reason?: string): Promise<{ pruned: number }>;
  fetchAuditLogs(options?: Record<string, unknown>): Promise<unknown>;
  setName(name: string): Promise<Guild>;
  setIcon(icon: string | null): Promise<Guild>;
  setBanner(banner: string | null): Promise<Guild>;
  setSplash(splash: string | null): Promise<Guild>;
  setVerificationLevel(level: number): Promise<Guild>;
  setDefaultMessageNotifications(level: number): Promise<Guild>;
  setExplicitContentFilter(level: number): Promise<Guild>;
  setSystemChannel(channelId: string | null): Promise<Guild>;
  setRulesChannel(channelId: string | null): Promise<Guild>;
  setPublicUpdatesChannel(channelId: string | null): Promise<Guild>;
  setPreferredLocale(locale: string): Promise<Guild>;
  setAFKChannel(channelId: string | null): Promise<Guild>;
  setAFKTimeout(timeout: number): Promise<Guild>;
  toString(): string;
}

export interface MessageData extends APIData {
  channel_id: string; author: UserData; content: string;
  timestamp: string; edited_timestamp: string | null;
  tts: boolean; mention_everyone: boolean; mentions: UserData[];
  mention_roles: string[]; pinned: boolean; type: number;
  guild_id?: string; components?: unknown[]; embeds?: unknown[];
  attachments?: unknown[]; reactions?: Array<{ emoji: { name: string; id?: string }; count: number; me: boolean }>;
  webhook_id?: string; application_id?: string; flags?: number;
  referenced_message?: MessageData | null;
}

export class Message extends Structure<MessageData> {
  constructor(client: Client, data: MessageData);
  get content(): string;
  get author(): User;
  get channelId(): string;
  get channel(): Channel | undefined;
  get guildId(): string | undefined;
  get createdTimestamp(): number;
  get editedTimestamp(): number | null;
  get pinned(): boolean;
  get tts(): boolean;
  get embeds(): unknown[];
  get components(): unknown[];
  get attachments(): unknown[];
  get reactions(): MessageData['reactions'];
  get webhookId(): string | undefined;
  get applicationId(): string | undefined;
  get isWebhook(): boolean;
  get flags(): number;
  get isCrosspost(): boolean;
  get isSuppressedEmbeds(): boolean;
  reply(content: string | Record<string, unknown>): Promise<Message>;
  edit(content: string | Record<string, unknown>): Promise<Message>;
  delete(): Promise<void>;
  react(emoji: string): Promise<void>;
  removeReaction(emoji: string, userId?: string): Promise<void>;
  removeAllReactions(): Promise<void>;
  pin(reason?: string): Promise<void>;
  unpin(reason?: string): Promise<void>;
  fetch(): Promise<Message>;
  crosspost(): Promise<Message>;
  suppressEmbeds(suppress?: boolean): Promise<Message>;
  toString(): string;
}

// ============================================================
// REST
// ============================================================

export interface RateLimitData { limit: number; remaining: number; reset: number; resetAfter: number; bucket: string; }
export interface QueuedRequest { resolve: (value: unknown) => void; reject: (reason: Error) => void; execute: () => Promise<unknown>; retries: number; }

export class Bucket {
  constructor(id: string, logger: Logger);
  get id(): string; get size(): number; get rateLimit(): RateLimitData | null;
  setGlobalReset(timestamp: number): void;
  updateRateLimit(data: RateLimitData): void;
  add(request: QueuedRequest): void;
}

export interface RequestOptions { method?: string; body?: Record<string, unknown> | unknown[]; headers?: Record<string, string>; reason?: string; retries?: number; }

export class DiscordAPIError extends Error {
  code: number; endpoint: string; errors?: unknown;
  constructor(code: number, message: string, endpoint: string, errors?: unknown);
  get meaning(): string;
  get humanReadable(): string;
}

export const DiscordErrorMap: Record<number, string>;

export class RestManager extends EventEmitter {
  constructor(client: Client, token: string);
  get authHeader(): string;
  setLogLevel(level: LogLevel): void;
  request<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  get<T>(endpoint: string): Promise<T>;
  post<T>(endpoint: string, body?: Record<string, unknown>): Promise<T>;
  patch<T>(endpoint: string, body?: Record<string, unknown>): Promise<T>;
  put<T>(endpoint: string, body?: Record<string, unknown>): Promise<T>;
  delete<T>(endpoint: string): Promise<T>;
}

// ============================================================
// GATEWAY
// ============================================================

type ShardState = 'idle' | 'connecting' | 'identifying' | 'ready' | 'resuming' | 'disconnected' | 'reconnecting';

export class Shard extends EventEmitter {
  constructor(client: Client, id: number, totalShards: number, gatewayURL: string, token: string, intents: number);
  get id(): number; get state(): ShardState; get sessionId(): string | null; get sequence(): number | null; get ping(): number;
  connect(): void;
  sendVoiceStateUpdate(guildId: string, channelId: string | null, selfMute?: boolean, selfDeaf?: boolean): void;
  destroy(): void;
}

export class ShardManager extends EventEmitter {
  constructor(client: Client, token: string, intents: number, shardCount: number, gatewayURL: string);
  get shards(): Map<number, Shard>;
  spawn(): Promise<void>;
  respawnAll(): Promise<void>;
  getShard(id: number): Shard | undefined;
  broadcast(payload: unknown): void;
  destroy(): void;
}

// ============================================================
// INTERACTIONS
// ============================================================

export interface InteractionData { id: string; application_id: string; type: InteractionType; data?: unknown; guild_id?: string; channel_id?: string; member?: unknown; user?: unknown; token: string; version: number; message?: unknown; locale?: string; guild_locale?: string; }
export interface InteractionReplyOptions { content?: string; embeds?: unknown[]; components?: unknown[]; ephemeral?: boolean; tts?: boolean; files?: unknown[]; }

type InteractionState = 'pending' | 'deferred' | 'replied' | 'followedUp';

export class Interaction {
  constructor(client: Client, data: InteractionData);
  get id(): string; get type(): InteractionType; get applicationId(): string;
  get guildId(): string | undefined; get channelId(): string | undefined;
  get token(): string; get user(): unknown | undefined;
  get member(): unknown | undefined; get commandName(): string | undefined;
  get customId(): string | undefined; get values(): string[] | undefined;
  get isCommand(): boolean; get isComponent(): boolean;
  get isModalSubmit(): boolean; get isAutocomplete(): boolean;
  get replied(): boolean; get deferred(): boolean; get state(): InteractionState;
  reply(options: InteractionReplyOptions | string): Promise<void>;
  deferReply(ephemeral?: boolean): Promise<void>;
  editReply(options: InteractionReplyOptions | string): Promise<unknown>;
  followUp(options: InteractionReplyOptions | string): Promise<unknown>;
  deferUpdate(): Promise<void>;
  update(options: InteractionReplyOptions | string): Promise<void>;
  showModal(modal: unknown): Promise<void>;
  deleteReply(): Promise<void>;
  fetchReply(): Promise<unknown>;
  getOption(name: string): unknown | undefined;
  getString(name: string): string | undefined;
  getInteger(name: string): number | undefined;
  getBoolean(name: string): boolean | undefined;
  getUser(name: string): unknown | undefined;
  toJSON(): InteractionData;
}

export interface CommandOption { name: string; description: string; type: number; required?: boolean; choices?: { name: string; value: string | number }[]; options?: CommandOption[]; channelTypes?: number[]; minValue?: number; maxValue?: number; minLength?: number; maxLength?: number; autocomplete?: boolean; }

export interface Command { name: string; description: string; type?: ApplicationCommandType; options?: CommandOption[]; defaultMemberPermissions?: string; dmPermission?: boolean; guildId?: string; execute: (interaction: Interaction) => void | Promise<void>; }

export class CommandHandler extends EventEmitter {
  constructor(client: Client);
  get commands(): Map<string, Command>;
  add(command: Command): this;
  addMany(commands: Command[]): this;
  remove(name: string): boolean;
  get(name: string): Command | undefined;
  registerGlobally(): Promise<unknown[]>;
  registerGuild(guildId: string): Promise<unknown[]>;
  handle(interaction: Interaction): Promise<void>;
}

// ============================================================
// VOICE
// ============================================================

export class VoiceUDP extends EventEmitter {
  constructor(ssrc: number);
  bind(): Promise<void>;
  performIPDiscovery(address: string, port: number): void;
  send(packet: Buffer): void;
  close(): void;
  get localAddress(): { ip: string; port: number } | undefined;
}

export class VoiceConnection extends EventEmitter {
  constructor(client: Client, guildId: string, channelId: string);
  get guildId(): string; get channelId(): string; get connected(): boolean; get ready(): boolean;
  connect(): Promise<void>;
  setSpeaking(speaking: boolean): void;
  sendAudioPacket(opusPacket: Buffer): void;
  disconnect(): void;
}

export const VoiceEncryptionModes: { XSALSA20_POLY1305: string; XSALSA20_POLY1305_SUFFIX: string; XSALSA20_POLY1305_LITE: string; AEAD_AES256_GCM: string; AEAD_AES256_GCM_RTPSIZE: string; };

// ============================================================
// CLIENT
// ============================================================

export interface CacheOptions { users?: boolean; guilds?: boolean; channels?: boolean; members?: boolean; messages?: boolean; sweepInterval?: number; sweepTTL?: number; }

export interface ClientOptions { token: string; intents?: number | IntentKey[]; shardCount?: number; cache?: CacheOptions; logLevel?: LogLevel; presence?: { status?: 'online' | 'dnd' | 'idle' | 'invisible' | 'offline'; activities?: Array<{ name: string; type: number; url?: string }>; }; }

export class Client extends EventEmitter {
  constructor(options: ClientOptions);
  get options(): ClientOptions;
  get rest(): RestManager;
  get commands(): CommandHandler;
  get shardManager(): ShardManager | null;
  get user(): User | null;
  get guilds(): Collection<string, Guild>;
  get channels(): Collection<string, Channel>;
  get users(): Collection<string, User>;
  get members(): Collection<string, Member>;
  get messages(): Collection<string, Message>;
  get voiceConnections(): Collection<string, VoiceConnection>;
  get ready(): boolean;
  get logger(): Logger;
  login(): Promise<string>;
  destroy(): Promise<void>;
  joinVoiceChannel(guildId: string, channelId: string): VoiceConnection;
  leaveVoiceChannel(guildId: string): void;
}
