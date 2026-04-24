import { Structure, type APIData } from './Base.js';
import { Collection } from '../utils/Collection.js';
import { Channel } from './Channel.js';
import { Member } from './Member.js';
import { Role, type RoleData } from './Role.js';
import type { Client } from '../client/Client.js';

export interface GuildData extends APIData {
  name: string;
  icon: string | null;
  owner_id: string;
  roles: RoleData[];
  emojis: unknown[];
  features: string[];
  member_count?: number;
  description?: string | null;
  premium_tier?: number;
  preferred_locale?: string;
  channels?: Array<Record<string, unknown>>;
  members?: Array<Record<string, unknown>>;
  verification_level?: number;
  default_message_notifications?: number;
  explicit_content_filter?: number;
  mfa_level?: number;
  system_channel_id?: string | null;
  rules_channel_id?: string | null;
  public_updates_channel_id?: string | null;
  vanity_url_code?: string | null;
  banner?: string | null;
  splash?: string | null;
  discovery_splash?: string | null;
  max_members?: number;
  max_presences?: number;
  max_video_channel_users?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  nsfw_level?: number;
  premium_subscription_count?: number;
}

export class Guild extends Structure<GuildData> {
  #client: Client;
  channels: Collection<string, Channel> = new Collection();
  members: Collection<string, Member> = new Collection();
  roles: Collection<string, Role> = new Collection();

  constructor(client: Client, data: GuildData) {
    super(data);
    this.#client = client;
  }

  get name(): string {
    return this._data.name;
  }

  get icon(): string | null {
    return this._data.icon;
  }

  get iconURL(): string | null {
    return this.icon
      ? `https://cdn.discordapp.com/icons/${this.id}/${this.icon}.png`
      : null;
  }

  get banner(): string | null | undefined {
    return this._data.banner;
  }

  get bannerURL(): string | null {
    return this.banner
      ? `https://cdn.discordapp.com/banners/${this.id}/${this.banner}.png`
      : null;
  }

  get splash(): string | null | undefined {
    return this._data.splash;
  }

  get splashURL(): string | null {
    return this.splash
      ? `https://cdn.discordapp.com/splashes/${this.id}/${this.splash}.png`
      : null;
  }

  get ownerId(): string {
    return this._data.owner_id;
  }

  get memberCount(): number {
    return this._data.member_count ?? 0;
  }

  get approximateMemberCount(): number | undefined {
    return this._data.approximate_member_count;
  }

  get approximatePresenceCount(): number | undefined {
    return this._data.approximate_presence_count;
  }

  get description(): string | null | undefined {
    return this._data.description;
  }

  get premiumTier(): number {
    return this._data.premium_tier ?? 0;
  }

  get premiumSubscriptionCount(): number | undefined {
    return this._data.premium_subscription_count;
  }

  get features(): string[] {
    return this._data.features;
  }

  get preferredLocale(): string {
    return this._data.preferred_locale ?? 'en-US';
  }

  get verificationLevel(): number {
    return this._data.verification_level ?? 0;
  }

  get defaultMessageNotifications(): number {
    return this._data.default_message_notifications ?? 0;
  }

  get explicitContentFilter(): number {
    return this._data.explicit_content_filter ?? 0;
  }

  get mfaLevel(): number {
    return this._data.mfa_level ?? 0;
  }

  get systemChannelId(): string | null | undefined {
    return this._data.system_channel_id;
  }

  get rulesChannelId(): string | null | undefined {
    return this._data.rules_channel_id;
  }

  get vanityURLCode(): string | null | undefined {
    return this._data.vanity_url_code;
  }

  get nsfwLevel(): number {
    return this._data.nsfw_level ?? 0;
  }

  get maxMembers(): number | undefined {
    return this._data.max_members;
  }

  get maxPresences(): number | undefined {
    return this._data.max_presences;
  }

  get maxVideoChannelUsers(): number | undefined {
    return this._data.max_video_channel_users;
  }

  get isPartnered(): boolean {
    return this.features.includes('PARTNERED');
  }

  get isVerified(): boolean {
    return this.features.includes('VERIFIED');
  }

  async fetch(): Promise<Guild> {
    const data = await this.#client.rest.get(`/guilds/${this.id}`);
    this.patch(data as GuildData);
    return this;
  }

  async edit(data: Partial<Omit<GuildData, 'id'>>): Promise<Guild> {
    const result = await this.#client.rest.patch(`/guilds/${this.id}`, data);
    this.patch(result as GuildData);
    return this;
  }

  async leave(): Promise<void> {
    await this.#client.rest.delete(`/users/@me/guilds/${this.id}`);
  }

  async delete(): Promise<void> {
    await this.#client.rest.delete(`/guilds/${this.id}`);
  }

  async fetchOwner(): Promise<Member | undefined> {
    const data = await this.#client.rest.get(`/guilds/${this.id}/members/${this.ownerId}`);
    const member = new Member(this.#client, { ...data, guild_id: this.id } as Parameters<typeof Member>[1]);
    this.members.set(member.userId!, member);
    return member;
  }

  async fetchMember(userId: string): Promise<Member> {
    const data = await this.#client.rest.get(`/guilds/${this.id}/members/${userId}`);
    const member = new Member(this.#client, { ...data, guild_id: this.id } as Parameters<typeof Member>[1]);
    this.members.set(member.userId!, member);
    return member;
  }

  async fetchRoles(): Promise<Collection<string, Role>> {
    const data = await this.#client.rest.get(`/guilds/${this.id}/roles`);
    this.roles.clear();
    for (const roleData of data as RoleData[]) {
      const role = new Role(this.#client, { ...roleData, guild_id: this.id });
      this.roles.set(role.id, role);
    }
    return this.roles;
  }

  async createRole(data: Partial<RoleData>): Promise<Role> {
    const result = await this.#client.rest.post(`/guilds/${this.id}/roles`, data);
    const role = new Role(this.#client, { ...result, guild_id: this.id } as RoleData);
    this.roles.set(role.id, role);
    return role;
  }

  async prune(days: number, reason?: string): Promise<{ pruned: number }> {
    return this.#client.rest.post(`/guilds/${this.id}/prune`, {
      days,
    }, { reason } as Record<string, unknown>) as Promise<{ pruned: number }>;
  }

  async fetchAuditLogs(options?: { user_id?: string; action_type?: number; before?: string; limit?: number }): Promise<unknown> {
    const query = new URLSearchParams();
    if (options?.user_id) query.set('user_id', options.user_id);
    if (options?.action_type) query.set('action_type', String(options.action_type));
    if (options?.before) query.set('before', options.before);
    if (options?.limit) query.set('limit', String(options.limit));
    return this.#client.rest.get(`/guilds/${this.id}/audit-logs?${query.toString()}`);
  }

  async setName(name: string): Promise<Guild> {
    return this.edit({ name });
  }

  async setIcon(icon: string | null): Promise<Guild> {
    return this.edit({ icon });
  }

  async setBanner(banner: string | null): Promise<Guild> {
    return this.edit({ banner });
  }

  async setSplash(splash: string | null): Promise<Guild> {
    return this.edit({ splash });
  }

  async setVerificationLevel(level: number): Promise<Guild> {
    return this.edit({ verification_level: level });
  }

  async setDefaultMessageNotifications(level: number): Promise<Guild> {
    return this.edit({ default_message_notifications: level });
  }

  async setExplicitContentFilter(level: number): Promise<Guild> {
    return this.edit({ explicit_content_filter: level });
  }

  async setSystemChannel(channelId: string | null): Promise<Guild> {
    return this.edit({ system_channel_id: channelId });
  }

  async setRulesChannel(channelId: string | null): Promise<Guild> {
    return this.edit({ rules_channel_id: channelId });
  }

  async setPublicUpdatesChannel(channelId: string | null): Promise<Guild> {
    return this.edit({ public_updates_channel_id: channelId });
  }

  async setPreferredLocale(locale: string): Promise<Guild> {
    return this.edit({ preferred_locale: locale });
  }

  async setAFKChannel(channelId: string | null): Promise<Guild> {
    return this.edit({ afk_channel_id: channelId });
  }

  async setAFKTimeout(timeout: number): Promise<Guild> {
    return this.edit({ afk_timeout: timeout });
  }

  toString(): string {
    return this.name;
  }
}
