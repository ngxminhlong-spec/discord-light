# Discord Light v2.0

A **production-ready**, lightweight, superfast, and reliable Discord library for Node.js with first-class voice support, slash commands, and advanced rate-limiting.

## Features

| Feature | Description |
|---------|-------------|
| **Zero Bloat** | Only `ws` dependency. Native `node:https`, `node:dgram`, `node:crypto` |
| **Distributed Rate Limiting** | Per-bucket queues with exponential backoff, global limit tracking |
| **Immortal Shards** | Auto-resume, zombie detection, exponential backoff reconnect |
| **Full Interactions** | Slash commands, buttons, select menus, modals with `.reply()`, `.deferReply()`, `.editReply()`, `.followUp()` |
| **Voice Ready** | UDP discovery, XSalsa20/AES256-GCM encryption, Opus streaming |
| **Smart Caching** | Optional per-entity caching with TTL sweep for memory efficiency |
| **Self-Healing** | Token validation, intent warnings, multi-level diagnostics logger |
| **TypeScript** | Strict types, full `.d.ts` declarations |

## Installation

```bash
npm install discord-light
# Optional: for voice encryption
npm install sodium-native
```

## Quick Start

```typescript
import { Client, Intents, LogLevel } from 'discord-light';

const client = new Client({
  token: process.env.DISCORD_TOKEN!,
  intents: ['GUILDS', 'GUILD_MESSAGES', 'MESSAGE_CONTENT'],
  logLevel: LogLevel.INFO,
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on('messageCreate', (message) => {
  if (message.content === '!ping') {
    message.reply('Pong!');
  }
});

client.login();
```

## Slash Commands

```typescript
import { type Command, createButton, createActionRow, ButtonStyle } from 'discord-light';

const askCommand: Command = {
  name: 'ask',
  description: 'Ask a question',
  options: [{
    name: 'question',
    description: 'Your question',
    type: 3,
    required: true,
  }],
  async execute(interaction) {
    await interaction.deferReply();
    const question = interaction.getString('question');

    // Your AI logic here...
    const answer = `Answer to: ${question}`;

    const button = createButton({
      customId: 'regenerate',
      label: 'Regenerate',
      style: ButtonStyle.PRIMARY,
    });

    await interaction.editReply({
      content: answer,
      components: [createActionRow([button])],
    });
  },
};

client.commands.add(askCommand);
client.on('ready', () => client.commands.registerGlobally());
```

## Voice

```typescript
client.on('messageCreate', async (message) => {
  if (message.content === '!join') {
    const voiceChannel = client.channels.find(ch => ch.name === 'General' && ch.isVoiceBased);
    if (voiceChannel) {
      const connection = client.joinVoiceChannel(message.guildId!, voiceChannel.id);
      connection.on('ready', () => {
        connection.setSpeaking(true);
        // Stream Opus: connection.sendAudioPacket(opusBuffer)
      });
    }
  }
});
```

## Cache Configuration

```typescript
const client = new Client({
  token: process.env.DISCORD_TOKEN!,
  cache: {
    users: true,
    guilds: true,
    channels: true,
    members: false,    // Disable member caching for large bots
    messages: true,
    sweepInterval: 300_000, // Sweep every 5 min
    sweepTTL: 600_000,      // Remove entries older than 10 min
  },
});
```

## Rate Limit Logic

The `RestManager` uses a **Distributed Bucket System**:

1. **Route Normalization**: Endpoints are normalized by replacing IDs with placeholders (`:channelId`, `:guildId`) to match Discord's rate limit buckets.
2. **Per-Bucket Queues**: Each unique route gets its own `Bucket` with a FIFO queue. Requests to the same bucket execute sequentially.
3. **Header Parsing**: `x-ratelimit-*` headers update bucket state dynamically.
4. **Global Tracking**: `x-ratelimit-global` triggers a global lock shared across all buckets.
5. **Exponential Backoff**: 429 and 5xx errors retry up to 3 times with `min(1000 * 2^attempt + jitter, 30000)` delay.
6. **Error Mapping**: Discord error codes are mapped to human-readable messages (e.g., "50001: Missing Access").

## Architecture

```
discord-light/
├── src/
│   ├── client/Client.ts          # Main client with diagnostics, caching
│   ├── rest/
│   │   ├── RestManager.ts        # HTTPS client with distributed buckets
│   │   └── Bucket.ts             # Per-route request queue
│   ├── gateway/
│   │   ├── Shard.ts              # Immortal WebSocket shard
│   │   └── ShardManager.ts       # Multi-shard orchestration
│   ├── interactions/
│   │   ├── Interaction.ts        # Interaction abstraction
│   │   └── CommandHandler.ts     # Slash command registry
│   ├── voice/
│   │   ├── VoiceConnection.ts    # Full voice connection
│   │   ├── VoiceUDP.ts           # UDP socket + IP discovery
│   │   └── VoiceOpcodes.ts       # Voice constants
│   ├── structures/               # User, Member, Guild, Channel, Message
│   └── utils/                    # Logger, Collection, Constants
├── types/index.d.ts              # Full TypeScript declarations
└── example.ts                    # Working example bot
```

## License

MIT
