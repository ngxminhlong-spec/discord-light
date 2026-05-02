// @ts-nocheck
import { Structure, type APIData } from './Base.js';
import type { User, UserData } from './User.js';
import type { Client } from '../client/Client.js';
import { PermissionsBitField } from '../utils/Permissions.js';

export interface MemberData extends APIData {
  user?: UserData;
  nick?: string | null;
  avatar?: string | null;
  roles: string[];
  joined_at: string;
  premium_since?: string | null;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending?: boolean;
  permissions?: string;
  communication_disabled_until?: string | null;
  guild_id?: string;
}

export class Member extends Structure<MemberData> {
  #client: Client;

  constructor(client: Client, data: MemberData) {
    super(data);
    this.#client = client;
  }

  get user(): UserData | undefined {
    return this._data.user;
  }

  get userId(): string | undefined {
    return this._data.user?.id;
  }

  get nick(): string | null | undefined {
    return this._data.nick;
  }

  get displayName(): string {
    return this.nick ?? this._data.user?.username ?? 'Unknown';
  }

  get roles(): string[] {
    return this._data.roles;
  }

  get joinedTimestamp(): number {
    return Date.parse(this._data.joined_at);
  }

  get deaf(): boolean {
    return this._data.deaf;
  }

  get mute(): boolean {
    return this._data.mute;
  }

  get pending(): boolean {
    return this._data.pending ?? false;
  }

  get permissions(): PermissionsBitField {
    return new PermissionsBitField(this._data.permissions ?? '0');
  }

  get guildId(): string | undefined {
    return this._data.guild_id;
  }

  get communicationDisabledUntil(): number | null {
    return this._data.communication_disabled_until
      ? Date.parse(this._data.communication_disabled_until)
      : null;
  }

  get isCommunicationDisabled(): boolean {
    const until = this.communicationDisabledUntil;
    return until !== null && until > Date.now();
  }

  get avatar(): string | null | undefined {
    return this._data.avatar;
  }

  get avatarURL(): string | null {
    if (this._data.avatar) {
      return `https://cdn.discordapp.com/guilds/${this.guildId}/users/${this.userId}/avatars/${this._data.avatar}.png`;
    }
    return null;
  }

  get displayAvatarURL(): string | null {
    return this.avatarURL ?? this._data.user?.avatar
      ? `https://cdn.discordapp.com/avatars/${this.userId}/${this._data.user!.avatar}.png`
      : null;
  }

  async kick(reason?: string): Promise<void> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot kick member: missing guild_id or user_id.');
    }
    await this.#client.rest.delete(`/guilds/${this.guildId}/members/${this.userId}`, { reason } as Record<string, unknown>);
  }

  async ban(options?: { deleteMessageSeconds?: number; reason?: string }): Promise<void> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot ban member: missing guild_id or user_id.');
    }
    await this.#client.rest.put(`/guilds/${this.guildId}/bans/${this.userId}`, {
      delete_message_seconds: options?.deleteMessageSeconds ?? 0,
    });
  }

  async timeout(durationMs: number, reason?: string): Promise<Member> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot timeout member: missing guild_id or user_id.');
    }
    const until = new Date(Date.now() + durationMs).toISOString();
    const data = await this.#client.rest.patch(`/guilds/${this.guildId}/members/${this.userId}`, {
      communication_disabled_until: until,
    });
    this.patch(data as MemberData);
    return this;
  }

  async removeTimeout(): Promise<Member> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot remove timeout: missing guild_id or user_id.');
    }
    const data = await this.#client.rest.patch(`/guilds/${this.guildId}/members/${this.userId}`, {
      communication_disabled_until: null,
    });
    this.patch(data as MemberData);
    return this;
  }

  async addRole(roleId: string, reason?: string): Promise<void> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot add role: missing guild_id or user_id.');
    }
    await this.#client.rest.put(`/guilds/${this.guildId}/members/${this.userId}/roles/${roleId}`, {}, { reason } as Record<string, unknown>);
  }

  async removeRole(roleId: string, reason?: string): Promise<void> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot remove role: missing guild_id or user_id.');
    }
    await this.#client.rest.delete(`/guilds/${this.guildId}/members/${this.userId}/roles/${roleId}`, { reason } as Record<string, unknown>);
  }

  async setNick(nick: string | null, reason?: string): Promise<Member> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot set nickname: missing guild_id or user_id.');
    }
    const data = await this.#client.rest.patch(`/guilds/${this.guildId}/members/${this.userId}`, {
      nick,
    }, { reason } as Record<string, unknown>);
    this.patch(data as MemberData);
    return this;
  }

  async deafen(deaf = true, reason?: string): Promise<Member> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot deafen member: missing guild_id or user_id.');
    }
    const data = await this.#client.rest.patch(`/guilds/${this.guildId}/members/${this.userId}`, {
      deaf,
    }, { reason } as Record<string, unknown>);
    this.patch(data as MemberData);
    return this;
  }

  async mute(mute = true, reason?: string): Promise<Member> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot mute member: missing guild_id or user_id.');
    }
    const data = await this.#client.rest.patch(`/guilds/${this.guildId}/members/${this.userId}`, {
      mute,
    }, { reason } as Record<string, unknown>);
    this.patch(data as MemberData);
    return this;
  }

  async move(channelId: string | null, reason?: string): Promise<Member> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot move member: missing guild_id or user_id.');
    }
    const data = await this.#client.rest.patch(`/guilds/${this.guildId}/members/${this.userId}`, {
      channel_id: channelId,
    }, { reason } as Record<string, unknown>);
    this.patch(data as MemberData);
    return this;
  }

  async fetch(): Promise<Member> {
    if (!this.guildId || !this.userId) {
      throw new Error('Cannot fetch member: missing guild_id or user_id.');
    }
    const data = await this.#client.rest.get(`/guilds/${this.guildId}/members/${this.userId}`);
    this.patch(data as MemberData);
    return this;
  }

  toString(): string {
    return `<@${this.userId}>`;
  }
}
