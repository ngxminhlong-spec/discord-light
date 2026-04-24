// Client
export { Client, type ClientOptions, type CacheOptions } from './client/Client.js';

// Structures
export { Structure, type APIData } from './structures/Base.js';
export { User, type UserData } from './structures/User.js';
export { Member, type MemberData } from './structures/Member.js';
export { Role, type RoleData } from './structures/Role.js';
export { Guild, type GuildData } from './structures/Guild.js';
export { Channel, type ChannelData } from './structures/Channel.js';
export { Message, type MessageData } from './structures/Message.js';

// Utils
export { Collection } from './utils/Collection.js';
export {
  Intents, ChannelType, API_VERSION, BASE_URL, CDN_URL,
  GatewayOpcodes, VoiceOpcodes, GatewayCloseCodes,
  ResumeableCloseCodes, FatalCloseCodes,
  InteractionType, ApplicationCommandType, MessageComponentType, ButtonStyle,
  HTTP_STATUS,
} from './utils/Constants.js';
export { Logger, LogLevel } from './utils/Logger.js';

// Builders (fluent API)
export {
  EmbedBuilder,
  ButtonBuilder,
  SelectMenuBuilder,
  ActionRowBuilder,
  type EmbedData,
  type EmbedField,
  type EmbedAuthor,
  type EmbedFooter,
  type EmbedImage,
  type ButtonData,
  type SelectMenuData,
  type SelectMenuOption,
  type ActionRowData,
} from './utils/Builders.js';

// Permissions
export { PermissionsBitField, PermissionFlags, type PermissionFlag } from './utils/Permissions.js';

// REST
export { RestManager, type RequestOptions, DiscordAPIError, DiscordErrorMap } from './rest/RestManager.js';
export { Bucket, type RateLimitData, type QueuedRequest } from './rest/Bucket.js';

// Gateway
export { Shard } from './gateway/Shard.js';
export { ShardManager } from './gateway/ShardManager.js';

// Interactions
export {
  Interaction,
  type InteractionData,
  type InteractionReplyOptions,
} from './interactions/Interaction.js';
export {
  CommandHandler,
  type Command,
  type CommandOption,
} from './interactions/CommandHandler.js';

// Voice
export { VoiceConnection } from './voice/VoiceConnection.js';
export { VoiceUDP } from './voice/VoiceUDP.js';
export { VoiceOpcodes, VoiceEncryptionModes } from './voice/VoiceOpcodes.js';
