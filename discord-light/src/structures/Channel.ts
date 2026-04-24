import { Structure, type APIData } from './Base.js';
import { ChannelType } from '../utils/Constants.js';
import type { Client } from '../client/Client.js';
import type { Message, MessageData } from './Message.js';

export interface ChannelData extends APIData {
  type: ChannelType;
  guild_id?: string;
  name?: string;
  topic?: string | null;
  nsfw?: boolean;
  last_message_id?: string | null;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  parent_id?: string | null;
  position?: number;
  permission_overwrites?: unknown[];
  rtc_region?: string | null;
  video_quality_mode?: number;
  default_auto_archive_duration?: number;
  flags?: number;
}

export class Channel extends Structure<ChannelData> {
  #client: Client;

  constructor(client: Client, data: ChannelData) {
    super(data);
    this.#client = client;
  }

  get type(): ChannelType {
    return this._data.type;
  }

  get name(): string | undefined {
    return this._data.name;
  }

  get guildId(): string | undefined {
    return this._data.guild_id;
  }

  get topic(): string | null | undefined {
    return this._data.topic;
  }

  get nsfw(): boolean {
    return this._data.nsfw ?? false;
  }

  get lastMessageId(): string | null | undefined {
    return this._data.last_message_id;
  }

  get bitrate(): number | undefined {
    return this._data.bitrate;
  }

  get userLimit(): number | undefined {
    return this._data.user_limit;
  }

  get rateLimitPerUser(): number | undefined {
    return this._data.rate_limit_per_user;
  }

  get parentId(): string | null | undefined {
    return this._data.parent_id;
  }

  get position(): number | undefined {
    return this._data.position;
  }

  get isTextBased(): boolean {
    return [
      ChannelType.GUILD_TEXT,
      ChannelType.DM,
      ChannelType.GUILD_ANNOUNCEMENT,
      ChannelType.ANNOUNCEMENT_THREAD,
      ChannelType.PUBLIC_THREAD,
      ChannelType.PRIVATE_THREAD,
    ].includes(this.type);
  }

  get isVoiceBased(): boolean {
    return [ChannelType.GUILD_VOICE, ChannelType.GUILD_STAGE_VOICE].includes(this.type);
  }

  get isThread(): boolean {
    return [
      ChannelType.ANNOUNCEMENT_THREAD,
      ChannelType.PUBLIC_THREAD,
      ChannelType.PRIVATE_THREAD,
    ].includes(this.type);
  }

  get isDM(): boolean {
    return this.type === ChannelType.DM;
  }

  get isCategory(): boolean {
    return this.type === ChannelType.GUILD_CATEGORY;
  }

  async send(content: string | Record<string, unknown>): Promise<Message> {
    const body = typeof content === 'string' ? { content } : content;
    const data = await this.#client.rest.post(`/channels/${this.id}/messages`, body);
    const { Message: MsgClass } = await import('./Message.js');
    return new MsgClass(this.#client, data as MessageData);
  }

  async edit(data: Partial<Omit<ChannelData, 'id'>>): Promise<Channel> {
    const result = await this.#client.rest.patch(`/channels/${this.id}`, data);
    this.patch(result as ChannelData);
    return this;
  }

  async delete(): Promise<void> {
    await this.#client.rest.delete(`/channels/${this.id}`);
  }

  async setName(name: string): Promise<Channel> {
    return this.edit({ name });
  }

  async setTopic(topic: string | null): Promise<Channel> {
    return this.edit({ topic });
  }

  async setNSFW(nsfw: boolean): Promise<Channel> {
    return this.edit({ nsfw });
  }

  async setRateLimitPerUser(seconds: number): Promise<Channel> {
    return this.edit({ rate_limit_per_user: seconds });
  }

  async setParent(parentId: string | null): Promise<Channel> {
    return this.edit({ parent_id: parentId });
  }

  async setPosition(position: number): Promise<Channel> {
    return this.edit({ position });
  }

  async fetchMessages(options?: { limit?: number; before?: string; after?: string; around?: string }): Promise<Message[]> {
    const query = new URLSearchParams();
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.before) query.set('before', options.before);
    if (options?.after) query.set('after', options.after);
    if (options?.around) query.set('around', options.around);
    const data = await this.#client.rest.get(`/channels/${this.id}/messages?${query.toString()}`);
    const { Message: MsgClass } = await import('./Message.js');
    return (data as MessageData[]).map(m => new MsgClass(this.#client, m));
  }

  async fetchMessage(messageId: string): Promise<Message> {
    const data = await this.#client.rest.get(`/channels/${this.id}/messages/${messageId}`);
    const { Message: MsgClass } = await import('./Message.js');
    return new MsgClass(this.#client, data as MessageData);
  }

  async bulkDelete(messageIds: string[], reason?: string): Promise<void> {
    await this.#client.rest.post(`/channels/${this.id}/messages/bulk-delete`, {
      messages: messageIds,
    }, { reason } as Record<string, unknown>);
  }

  async createInvite(options?: { max_age?: number; max_uses?: number; temporary?: boolean; unique?: boolean; target_type?: number; target_user_id?: string; target_application_id?: string }): Promise<unknown> {
    return this.#client.rest.post(`/channels/${this.id}/invites`, options ?? {});
  }

  async fetchInvites(): Promise<unknown> {
    return this.#client.rest.get(`/channels/${this.id}/invites`);
  }

  async typing(): Promise<void> {
    await this.#client.rest.post(`/channels/${this.id}/typing`, {});
  }

  async fetchWebhooks(): Promise<unknown> {
    return this.#client.rest.get(`/channels/${this.id}/webhooks`);
  }

  async createWebhook(name: string, avatar?: string | null): Promise<unknown> {
    return this.#client.rest.post(`/channels/${this.id}/webhooks`, { name, avatar });
  }

  toString(): string {
    return `<#${this.id}>`;
  }
}
