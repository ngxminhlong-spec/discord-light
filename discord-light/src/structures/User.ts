import { Structure, type APIData } from './Base.js';

export interface UserData extends APIData {
  username: string;
  discriminator: string;
  avatar: string | null;
  bot?: boolean;
  system?: boolean;
  banner?: string | null;
  accent_color?: number | null;
}

export class User extends Structure<UserData> {
  get username(): string {
    return this._data.username;
  }

  get discriminator(): string {
    return this._data.discriminator;
  }

  get tag(): string {
    return `${this._data.username}#${this._data.discriminator}`;
  }

  get avatar(): string | null {
    return this._data.avatar;
  }

  get avatarURL(): string | null {
    return this.avatar
      ? `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.png`
      : null;
  }

  get defaultAvatarURL(): string {
    const index = parseInt(this.discriminator) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }

  get displayAvatarURL(): string {
    return this.avatarURL ?? this.defaultAvatarURL;
  }

  get bot(): boolean {
    return this._data.bot ?? false;
  }

  toString(): string {
    return `<@${this.id}>`;
  }
}
