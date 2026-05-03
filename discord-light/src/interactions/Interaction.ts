// @ts-nocheck
import { InteractionType, MessageComponentType, ButtonStyle } from '../utils/Constants.js';
import type { Client } from '../client/Client.js';

export interface InteractionData {
  id: string;
  application_id: string;
  type: InteractionType;
  data?: ApplicationCommandData | MessageComponentData | ModalSubmitData;
  guild_id?: string;
  channel_id?: string;
  member?: GuildMemberData;
  user?: UserData;
  token: string;
  version: number;
  message?: MessageData;
  locale?: string;
  guild_locale?: string;
}

interface ApplicationCommandData {
  id: string;
  name: string;
  type: number;
  resolved?: unknown;
  options?: CommandOptionData[];
  guild_id?: string;
  target_id?: string;
}

interface CommandOptionData {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: CommandOptionData[];
  focused?: boolean;
}

interface MessageComponentData {
  custom_id: string;
  component_type: MessageComponentType;
  values?: string[];
}

interface ModalSubmitData {
  custom_id: string;
  components: ModalActionRowData[];
}

interface ModalActionRowData {
  type: number;
  components: { custom_id: string; type: number; value: string }[];
}

interface GuildMemberData {
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
}

interface UserData {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  bot?: boolean;
  system?: boolean;
}

interface MessageData {
  id: string;
  channel_id: string;
  author: UserData;
  content: string;
  timestamp: string;
  components?: unknown[];
  embeds?: unknown[];
}

export interface InteractionReplyOptions {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  ephemeral?: boolean;
  tts?: boolean;
  files?: unknown[];
}

type InteractionState = 'pending' | 'deferred' | 'replied' | 'followedUp';

export class Interaction {
  #client: Client;
  #data: InteractionData;
  #state: InteractionState = 'pending';

  constructor(client: Client, data: InteractionData) {
    this.#client = client;
    this.#data = data;
  }

  get id(): string {
    return this.#data.id;
  }

  get type(): InteractionType {
    return this.#data.type;
  }

  get applicationId(): string {
    return this.#data.application_id;
  }

  get guildId(): string | undefined {
    return this.#data.guild_id;
  }

  get channelId(): string | undefined {
    return this.#data.channel_id;
  }

  get token(): string {
    return this.#data.token;
  }

  get user(): UserData | undefined {
    return this.#data.user ?? this.#data.member?.user;
  }

  get member(): GuildMemberData | undefined {
    return this.#data.member;
  }

  get commandName(): string | undefined {
    if (this.#data.data && 'name' in this.#data.data) {
      return this.#data.data.name;
    }
    return undefined;
  }

  get customId(): string | undefined {
    if (this.#data.data && 'custom_id' in this.#data.data) {
      return this.#data.data.custom_id;
    }
    return undefined;
  }

  get values(): string[] | undefined {
    if (this.#data.data && 'values' in this.#data.data) {
      return this.#data.data.values;
    }
    return undefined;
  }

  get isCommand(): boolean {
    return this.type === InteractionType.APPLICATION_COMMAND;
  }

  get isComponent(): boolean {
    return this.type === InteractionType.MESSAGE_COMPONENT;
  }

  get isModalSubmit(): boolean {
    return this.type === InteractionType.MODAL_SUBMIT;
  }

  get isAutocomplete(): boolean {
    return this.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE;
  }

  get replied(): boolean {
    return this.#state === 'replied' || this.#state === 'followedUp';
  }

  get deferred(): boolean {
    return this.#state === 'deferred';
  }

  get state(): InteractionState {
    return this.#state;
  }

  /**
   * Reply to the interaction.
   * If already deferred, automatically routes to editReply() instead.
   * If already replied, throws with guidance to use followUp() or editReply().
   */
  async reply(options: InteractionReplyOptions | string): Promise<void> {
    const body = typeof options === 'string' ? { content: options } : options;

    if (this.#state === 'replied' || this.#state === 'followedUp') {
      throw new Error(
        `Interaction has already been replied to (state: ${this.#state}). ` +
        `Use .editReply() to modify the original response, or .followUp() to send a new message.`
      );
    }

    // SMART ROUTING: If deferred but not yet replied, route to editReply
    // This prevents the "Interaction already acknowledged" error
    if (this.#state === 'deferred') {
      this.#client.logger?.debug(
        'Interaction %s: .reply() called after .deferReply() — routing to .editReply()',
        this.id
      );
      await this.editReply(body);
      return;
    }

    const payload = {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: body.content,
        embeds: body.embeds,
        components: body.components,
        tts: body.tts ?? false,
        flags: body.ephemeral ? 64 : undefined,
      },
    };

    await this.#client.rest.post(`/interactions/${this.id}/${this.token}/callback`, payload);
    this.#state = 'replied';
  }

  /**
   * Defer the reply. Extends the response window from 3s to 15 minutes.
   * After deferring, .reply() will automatically route to .editReply().
   */
  async deferReply(ephemeral = false): Promise<void> {
    if (this.#state !== 'pending') {
      throw new Error(
        `Cannot defer reply: interaction is already in state "${this.#state}". ` +
        `Only call .deferReply() once, before any .reply() or .editReply().`
      );
    }

    const payload = {
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        flags: ephemeral ? 64 : undefined,
      },
    };

    await this.#client.rest.post(`/interactions/${this.id}/${this.token}/callback`, payload);
    this.#state = 'deferred';
  }

  /**
   * Edit the original interaction response.
   * Works after both .deferReply() and .reply().
   */
  async editReply(options: InteractionReplyOptions | string): Promise<unknown> {
    const body = typeof options === 'string' ? { content: options } : options;
    const payload = {
      content: body.content,
      embeds: body.embeds,
      components: body.components,
    };

    const result = await this.#client.rest.patch(
      `/webhooks/${this.applicationId}/${this.token}/messages/@original`,
      payload
    );

    // If we were pending, transition to replied (editReply can be first response for deferred)
    if (this.#state === 'pending' || this.#state === 'deferred') {
      this.#state = 'replied';
    }

    return result;
  }

  /**
   * Send a follow-up message. Creates a new message, does not modify the original.
   */
  async followUp(options: InteractionReplyOptions | string): Promise<unknown> {
    const body = typeof options === 'string' ? { content: options } : options;
    const payload = {
      content: body.content,
      embeds: body.embeds,
      components: body.components,
      tts: body.tts ?? false,
      flags: body.ephemeral ? 64 : undefined,
    };

    const result = await this.#client.rest.post(
      `/webhooks/${this.applicationId}/${this.token}`,
      payload
    );

    this.#state = 'followedUp';
    return result;
  }

  /**
   * Defer an update for a component interaction (button/select menu).
   * Shows a loading state on the component without changing the message yet.
   */
  async deferUpdate(): Promise<void> {
    if (this.type !== InteractionType.MESSAGE_COMPONENT) {
      throw new Error('.deferUpdate() can only be used on component interactions.');
    }

    if (this.#state !== 'pending') {
      throw new Error(`Cannot defer update: interaction is already in state "${this.#state}".`);
    }

    await this.#client.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
      type: 6, // DEFERRED_UPDATE_MESSAGE
    });
    this.#state = 'deferred';
  }

  /**
   * Update the message for a component interaction.
   */
  async update(options: InteractionReplyOptions | string): Promise<void> {
    if (this.type !== InteractionType.MESSAGE_COMPONENT) {
      throw new Error('.update() can only be used on component interactions.');
    }

    const body = typeof options === 'string' ? { content: options } : options;

    // Smart routing: if deferred, edit the original instead
    if (this.#state === 'deferred') {
      await this.editReply(body);
      return;
    }

    if (this.#state === 'replied' || this.#state === 'followedUp') {
      throw new Error(
        'Component interaction already responded. Use .editReply() or .followUp() instead.'
      );
    }

    await this.#client.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
      type: 7, // UPDATE_MESSAGE
      data: {
        content: body.content,
        embeds: body.embeds,
        components: body.components,
      },
    });
    this.#state = 'replied';
  }

  /**
   * Show a modal in response to an interaction.
   */
  async showModal(modal: unknown): Promise<void> {
    if (this.#state !== 'pending') {
      throw new Error(`Cannot show modal: interaction is already in state "${this.#state}".`);
    }

    await this.#client.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
      type: 9, // MODAL
      data: modal,
    });
    this.#state = 'replied';
  }

  /**
   * Delete the original interaction response.
   */
  async deleteReply(): Promise<void> {
    await this.#client.rest.delete(`/webhooks/${this.applicationId}/${this.token}/messages/@original`);
  }

  /**
   * Fetch the original interaction response.
   */
  async fetchReply(): Promise<unknown> {
    return this.#client.rest.get(`/webhooks/${this.applicationId}/${this.token}/messages/@original`);
  }

  // Option helpers
  getOption(name: string): CommandOptionData | undefined {
    if (!this.isCommand || !this.#data.data || !('options' in this.#data.data)) {
      return undefined;
    }
    return this.#data.data.options?.find(opt => opt.name === name);
  }

  getString(name: string): string | undefined {
    const opt = this.getOption(name);
    return opt?.value as string | undefined;
  }

  getInteger(name: string): number | undefined {
    const opt = this.getOption(name);
    return opt?.value as number | undefined;
  }

  getBoolean(name: string): boolean | undefined {
    const opt = this.getOption(name);
    return opt?.value as boolean | undefined;
  }

  getUser(name: string): UserData | undefined {
    const opt = this.getOption(name);
    if (!opt) return undefined;
    const resolved = (this.#data.data as ApplicationCommandData)?.resolved;
    if (resolved && typeof resolved === 'object' && 'users' in resolved) {
      const users = (resolved as Record<string, unknown>).users as Record<string, UserData>;
      return users?.[opt.value as string];
    }
    return undefined;
  }

  toJSON(): InteractionData {
    return this.#data;
  }
}

export function createButton(options: {
  customId: string;
  label: string;
  style?: ButtonStyle;
  emoji?: string;
  disabled?: boolean;
}): Record<string, unknown> {
  return {
    type: MessageComponentType.BUTTON,
    custom_id: options.customId,
    label: options.label,
    style: options.style ?? ButtonStyle.PRIMARY,
    emoji: options.emoji ? { name: options.emoji } : undefined,
    disabled: options.disabled ?? false,
  };
}

export function createActionRow(components: unknown[]): Record<string, unknown> {
  return {
    type: MessageComponentType.ACTION_ROW,
    components,
  };
}
