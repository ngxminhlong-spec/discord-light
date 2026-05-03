// @ts-nocheck
import { Structure, type APIData } from './Base.js';
import { User, type UserData } from './User.js';
import type { Channel } from './Channel.js';
import type { Client } from '../client/Client.js';

export interface MessageData extends APIData {
  channel_id: string;
  author: UserData;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: UserData[];
  mention_roles: string[];
  pinned: boolean;
  type: number;
  guild_id?: string;
  components?: unknown[];
  embeds?: unknown[];
  attachments?: unknown[];
  reactions?: Array<{ emoji: { name: string; id?: string }; count: number; me: boolean }>;
  webhook_id?: string;
  application_id?: string;
  activity?: unknown;
  application?: unknown;
  message_reference?: {
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
  };
  flags?: number;
  referenced_message?: MessageData | null;
  interaction?: unknown;
  thread?: unknown;
  position?: number;
  role_subscription_data?: unknown;
}

export class Message extends Structure<MessageData> {
  #client: Client;
  #author: User;

  constructor(client: Client, data: MessageData) {
    super(data);
    this.#client = client;
    this.#author = new User(data.author);
  }

  get content(): string {
    return this._data.content;
  }

  get author(): User {
    const cached = this.#client.users.get(this._data.author.id);
    return cached ?? this.#author;
  }

  get channelId(): string {
    return this._data.channel_id;
  }

  get channel(): Channel | undefined {
    return this.#client.channels.get(this.channelId);
  }

  get guildId(): string | undefined {
    return this._data.guild_id;
  }

  get createdTimestamp(): number {
    return Date.parse(this._data.timestamp);
  }

  get editedTimestamp(): number | null {
    return this._data.edited_timestamp ? Date.parse(this._data.edited_timestamp) : null;
  }

  get pinned(): boolean {
    return this._data.pinned;
  }

  get tts(): boolean {
    return this._data.tts;
  }

  get embeds(): unknown[] {
    return this._data.embeds ?? [];
  }

  get components(): unknown[] {
    return this._data.components ?? [];
  }

  get attachments(): unknown[] {
    return this._data.attachments ?? [];
  }

  get reactions(): MessageData['reactions'] {
    return this._data.reactions;
  }

  get webhookId(): string | undefined {
    return this._data.webhook_id;
  }

  get applicationId(): string | undefined {
    return this._data.application_id;
  }

  get isWebhook(): boolean {
    return !!this._data.webhook_id;
  }

  get flags(): number {
    return this._data.flags ?? 0;
  }

  get isCrosspost(): boolean {
    return (this.flags & 1) === 1;
  }

  get isSuppressedEmbeds(): boolean {
    return (this.flags & 4) === 4;
  }

  /**
   * Smart reply: accepts string, embed object, or full message payload.
   */
  async reply(content: string | { content?: string; embeds?: unknown[]; components?: unknown[]; tts?: boolean; allowed_mentions?: unknown }): Promise<Message> {
    const body = typeof content === 'string' ? { content } : content;
    const data = await this.#client.rest.post(`/channels/${this.channelId}/messages`, {
      ...body,
      message_reference: {
        message_id: this.id,
        channel_id: this.channelId,
        guild_id: this.guildId,
        fail_if_not_exists: false,
      },
    });
    return new Message(this.#client, data as MessageData);
  }

  async edit(content: string | Record<string, unknown>): Promise<Message> {
    const body = typeof content === 'string' ? { content } : content;
    const data = await this.#client.rest.patch(`/channels/${this.channelId}/messages/${this.id}`, body);
    return new Message(this.#client, data as MessageData);
  }

  async delete(): Promise<void> {
    await this.#client.rest.delete(`/channels/${this.channelId}/messages/${this.id}`);
  }

  async react(emoji: string): Promise<void> {
    const encoded = encodeURIComponent(emoji);
    await this.#client.rest.put(`/channels/${this.channelId}/messages/${this.id}/reactions/${encoded}/@me`, {});
  }

  async removeReaction(emoji: string, userId = '@me'): Promise<void> {
    const encoded = encodeURIComponent(emoji);
    await this.#client.rest.delete(`/channels/${this.channelId}/messages/${this.id}/reactions/${encoded}/${userId}`);
  }

  async removeAllReactions(): Promise<void> {
    await this.#client.rest.delete(`/channels/${this.channelId}/messages/${this.id}/reactions`);
  }

  async pin(reason?: string): Promise<void> {
    await this.#client.rest.put(`/channels/${this.channelId}/pins/${this.id}`, {}, { reason } as Record<string, unknown>);
  }

  async unpin(reason?: string): Promise<void> {
    await this.#client.rest.delete(`/channels/${this.channelId}/pins/${this.id}`, { reason } as Record<string, unknown>);
  }

  async fetch(): Promise<Message> {
    const data = await this.#client.rest.get(`/channels/${this.channelId}/messages/${this.id}`);
    this.patch(data as MessageData);
    return this;
  }

  async crosspost(): Promise<Message> {
    const data = await this.#client.rest.post(`/channels/${this.channelId}/messages/${this.id}/crosspost`);
    return new Message(this.#client, data as MessageData);
  }

  async suppressEmbeds(suppress = true): Promise<Message> {
    const flags = suppress ? (this.flags | 4) : (this.flags & ~4);
    const data = await this.#client.rest.patch(`/channels/${this.channelId}/messages/${this.id}`, { flags });
    return new Message(this.#client, data as MessageData);
  }

  toString(): string {
    return this.content;
  }
}
