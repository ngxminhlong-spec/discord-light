import { EventEmitter } from 'node:events';
import { ApplicationCommandType } from '../utils/Constants.js';
import { Interaction } from './Interaction.js';
import { Logger, LogLevel } from '../utils/Logger.js';
import type { Client } from '../client/Client.js';

export interface Command {
  name: string;
  description: string;
  type?: ApplicationCommandType;
  options?: CommandOption[];
  defaultMemberPermissions?: string;
  dmPermission?: boolean;
  guildId?: string;
  execute: (interaction: Interaction) => void | Promise<void>;
}

export interface CommandOption {
  name: string;
  description: string;
  type: number;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  options?: CommandOption[];
  channelTypes?: number[];
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
  autocomplete?: boolean;
}

export class CommandHandler extends EventEmitter {
  #client: Client;
  #commands: Map<string, Command> = new Map();
  #logger: Logger;

  constructor(client: Client) {
    super();
    this.#client = client;
    this.#logger = new Logger(LogLevel.INFO, 'CommandHandler');
  }

  get commands(): Map<string, Command> {
    return this.#commands;
  }

  add(command: Command): this {
    this.#commands.set(command.name.toLowerCase(), command);
    this.#logger.info('Registered command: %s', command.name);
    return this;
  }

  addMany(commands: Command[]): this {
    for (const cmd of commands) {
      this.add(cmd);
    }
    return this;
  }

  remove(name: string): boolean {
    return this.#commands.delete(name.toLowerCase());
  }

  get(name: string): Command | undefined {
    return this.#commands.get(name.toLowerCase());
  }

  async registerGlobally(): Promise<unknown[]> {
    const payload = Array.from(this.#commands.values()).map(cmd => this.#toJSON(cmd));
    this.#logger.info('Registering %d commands globally...', payload.length);
    return this.#client.rest.put(
      `/applications/${this.#client.user!.id}/commands`,
      payload as unknown as Record<string, unknown>
    );
  }

  async registerGuild(guildId: string): Promise<unknown[]> {
    const payload = Array.from(this.#commands.values())
      .filter(cmd => !cmd.guildId || cmd.guildId === guildId)
      .map(cmd => this.#toJSON(cmd));
    this.#logger.info('Registering %d commands to guild %s...', payload.length, guildId);
    return this.#client.rest.put(
      `/applications/${this.#client.user!.id}/guilds/${guildId}/commands`,
      payload as unknown as Record<string, unknown>
    );
  }

  async handle(interaction: Interaction): Promise<void> {
    if (!interaction.isCommand) return;

    const command = this.#commands.get(interaction.commandName?.toLowerCase() ?? '');
    if (!command) {
      this.#logger.warn('Unknown command: %s', interaction.commandName);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      this.#logger.error('Command %s execution failed: %s', command.name, (err as Error).message);
      this.emit('commandError', err as Error, interaction);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while executing this command.',
          ephemeral: true,
        }).catch(() => {});
      }
    }
  }

  #toJSON(command: Command): Record<string, unknown> {
    return {
      name: command.name,
      description: command.description,
      type: command.type ?? ApplicationCommandType.CHAT_INPUT,
      options: command.options,
      default_member_permissions: command.defaultMemberPermissions,
      dm_permission: command.dmPermission,
    };
  }
}
