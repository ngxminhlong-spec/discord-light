// @ts-nocheck
import { Structure, type APIData } from './Base.js';
import type { Client } from '../client/Client.js';
import { PermissionsBitField } from '../utils/Permissions.js';

export interface RoleData extends APIData {
  name: string;
  color: number;
  hoist: boolean;
  icon?: string | null;
  unicode_emoji?: string | null;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  tags?: {
    bot_id?: string;
    integration_id?: string;
    premium_subscriber?: null;
    subscription_listing_id?: string;
    available_for_purchase?: null;
    guild_connections?: null;
  };
  flags: number;
  guild_id?: string;
}

export class Role extends Structure<RoleData> {
  #client: Client;

  constructor(client: Client, data: RoleData) {
    super(data);
    this.#client = client;
  }

  get name(): string {
    return this._data.name;
  }

  get color(): number {
    return this._data.color;
  }

  get hexColor(): string {
    return `#${this._data.color.toString(16).padStart(6, '0')}`;
  }

  get hoist(): boolean {
    return this._data.hoist;
  }

  get icon(): string | null | undefined {
    return this._data.icon;
  }

  get unicodeEmoji(): string | null | undefined {
    return this._data.unicode_emoji;
  }

  get position(): number {
    return this._data.position;
  }

  get permissions(): PermissionsBitField {
    return new PermissionsBitField(this._data.permissions);
  }

  get managed(): boolean {
    return this._data.managed;
  }

  get mentionable(): boolean {
    return this._data.mentionable;
  }

  get guildId(): string | undefined {
    return this._data.guild_id;
  }

  get flags(): number {
    return this._data.flags;
  }

  get tags(): RoleData['tags'] {
    return this._data.tags;
  }

  get isPremiumRole(): boolean {
    return this._data.tags?.premium_subscriber === null;
  }

  get isBotRole(): boolean {
    return !!this._data.tags?.bot_id;
  }

  async edit(data: Partial<Omit<RoleData, 'id' | 'guild_id'>>): Promise<Role> {
    const result = await this.#client.rest.patch(`/guilds/${this.guildId}/roles/${this.id}`, data);
    this.patch(result as RoleData);
    return this;
  }

  async setName(name: string): Promise<Role> {
    return this.edit({ name });
  }

  async setColor(color: number | string): Promise<Role> {
    const resolved = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
    return this.edit({ color: resolved });
  }

  async setHoist(hoist: boolean): Promise<Role> {
    return this.edit({ hoist });
  }

  async setMentionable(mentionable: boolean): Promise<Role> {
    return this.edit({ mentionable });
  }

  async setPermissions(permissions: bigint | string | PermissionsBitField): Promise<Role> {
    const bitfield = permissions instanceof PermissionsBitField ? permissions.bitfield : BigInt(permissions);
    return this.edit({ permissions: bitfield.toString() });
  }

  async setPosition(position: number): Promise<Role> {
    await this.#client.rest.patch(`/guilds/${this.guildId}/roles`, {
      id: this.id,
      position,
    });
    this._data.position = position;
    return this;
  }

  async delete(reason?: string): Promise<void> {
    await this.#client.rest.delete(`/guilds/${this.guildId}/roles/${this.id}`, { reason } as Record<string, unknown>);
  }

  toString(): string {
    return `<@&${this.id}>`;
  }
}
