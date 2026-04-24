export const PermissionFlags = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 1n << 41n,
  USE_SOUNDBOARD: 1n << 42n,
  CREATE_GUILD_EXPRESSIONS: 1n << 43n,
  CREATE_EVENTS: 1n << 44n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  SEND_VOICE_MESSAGES: 1n << 46n,
  SEND_POLLS: 1n << 49n,
  USE_EXTERNAL_APPS: 1n << 50n,
} as const;

export type PermissionFlag = keyof typeof PermissionFlags;

export class PermissionsBitField {
  #bitfield: bigint;

  constructor(bits: bigint | string | number | PermissionsBitField = 0n) {
    if (bits instanceof PermissionsBitField) {
      this.#bitfield = bits.bitfield;
    } else {
      this.#bitfield = BigInt(bits);
    }
  }

  get bitfield(): bigint {
    return this.#bitfield;
  }

  has(...permissions: PermissionFlag[]): boolean {
    const bits = permissions.reduce((acc, p) => acc | PermissionFlags[p], 0n);
    return (this.#bitfield & bits) === bits;
  }

  hasAny(...permissions: PermissionFlag[]): boolean {
    const bits = permissions.reduce((acc, p) => acc | PermissionFlags[p], 0n);
    return (this.#bitfield & bits) !== 0n;
  }

  missing(...permissions: PermissionFlag[]): PermissionFlag[] {
    return permissions.filter(p => (this.#bitfield & PermissionFlags[p]) !== PermissionFlags[p]);
  }

  add(...permissions: PermissionFlag[]): this {
    const bits = permissions.reduce((acc, p) => acc | PermissionFlags[p], 0n);
    this.#bitfield |= bits;
    return this;
  }

  remove(...permissions: PermissionFlag[]): this {
    const bits = permissions.reduce((acc, p) => acc | PermissionFlags[p], 0n);
    this.#bitfield &= ~bits;
    return this;
  }

  toggle(...permissions: PermissionFlag[]): this {
    const bits = permissions.reduce((acc, p) => acc | PermissionFlags[p], 0n);
    this.#bitfield ^= bits;
    return this;
  }

  freeze(): Readonly<PermissionsBitField> {
    return Object.freeze(new PermissionsBitField(this.#bitfield));
  }

  serialize(): Record<PermissionFlag, boolean> {
    const result = {} as Record<PermissionFlag, boolean>;
    for (const [name, bit] of Object.entries(PermissionFlags)) {
      result[name as PermissionFlag] = (this.#bitfield & bit) === bit;
    }
    return result;
  }

  toArray(): PermissionFlag[] {
    return Object.entries(PermissionFlags)
      .filter(([, bit]) => (this.#bitfield & bit) === bit)
      .map(([name]) => name as PermissionFlag);
  }

  toJSON(): string {
    return this.#bitfield.toString();
  }

  valueOf(): bigint {
    return this.#bitfield;
  }

  equals(other: PermissionsBitField | bigint | string | number): boolean {
    const otherBits = other instanceof PermissionsBitField ? other.bitfield : BigInt(other);
    return this.#bitfield === otherBits;
  }

  static resolve(permission: PermissionFlag | bigint | string | number): bigint {
    if (typeof permission === 'string' && permission in PermissionFlags) {
      return PermissionFlags[permission as PermissionFlag];
    }
    return BigInt(permission);
  }

  static all(): PermissionsBitField {
    return new PermissionsBitField(
      Object.values(PermissionFlags).reduce((acc, bit) => acc | bit, 0n)
    );
  }

  static default(): PermissionsBitField {
    return new PermissionsBitField(
      PermissionFlags.VIEW_CHANNEL |
      PermissionFlags.SEND_MESSAGES |
      PermissionFlags.CHANGE_NICKNAME |
      PermissionFlags.USE_APPLICATION_COMMANDS
    );
  }
}
