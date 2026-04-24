import {
  Client,
  Intents,
  LogLevel,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  PermissionsBitField,
  ButtonStyle,
  type Interaction,
  type Command,
  type Message,
} from './src/index.js';

const client = new Client({
  token: process.env.DISCORD_TOKEN!,
  intents: [
    'GUILDS',
    'GUILD_MESSAGES',
    'GUILD_MEMBERS',
    'GUILD_VOICE_STATES',
    'MESSAGE_CONTENT',
    'GUILD_MESSAGE_REACTIONS',
  ],
  logLevel: LogLevel.INFO,
  cache: {
    users: true,
    guilds: true,
    channels: true,
    members: true,
    messages: true,
    sweepInterval: 300_000,
    sweepTTL: 600_000,
  },
});

// ============================================================
// COMMANDS
// ============================================================

const userinfoCommand: Command = {
  name: 'userinfo',
  description: 'Show detailed information about a user',
  options: [
    {
      name: 'user',
      description: 'The user to inspect',
      type: 6, // USER
      required: true,
    },
  ],
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ This command only works in servers.', ephemeral: true });
      return;
    }

    const targetUser = interaction.getUser('user');
    if (!targetUser) {
      await interaction.reply({ content: '❌ Could not find that user.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const guild = client.guilds.get(interaction.guildId);
    const member = guild ? await guild.fetchMember(targetUser.id).catch(() => null) : null;

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.username}`)
      .setColor(member ? 0x5865F2 : 0x999999)
      .setThumbnail(`https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.png`)
      .addFields(
        { name: '🆔 User ID', value: targetUser.id, inline: true },
        { name: '🏷️ Username', value: targetUser.username, inline: true },
        { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
      );

    if (member) {
      embed
        .addFields(
          { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: '🎭 Nickname', value: member.nick ?? 'None', inline: true },
          { name: '🔇 Timed Out', value: member.isCommunicationDisabled ? 'Yes' : 'No', inline: true },
          { name: '🏷️ Roles', value: member.roles.length > 0 ? `<@&${member.roles.slice(0, 5).join('> <@&')}>` : 'None' },
        )
        .setFooter({ text: `Requested by ${interaction.user?.username ?? 'Unknown'}` })
        .setTimestamp();
    } else {
      embed.setDescription('This user is not a member of this server.');
    }

    await interaction.editReply({ embeds: [embed.toJSON()] });
  },
};

const warnCommand: Command = {
  name: 'warn',
  description: 'Warn a member with a confirmation button',
  options: [
    { name: 'member', description: 'Member to warn', type: 6, required: true },
    { name: 'reason', description: 'Reason for warning', type: 3, required: true },
  ],
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ Server only.', ephemeral: true });
      return;
    }

    const perms = interaction.member?.permissions;
    if (!perms || !new PermissionsBitField(perms).has('MODERATE_MEMBERS')) {
      await interaction.reply({ content: '❌ You need **Moderate Members** permission.', ephemeral: true });
      return;
    }

    const targetUser = interaction.getUser('member');
    const reason = interaction.getString('reason') ?? 'No reason';

    if (!targetUser) {
      await interaction.reply({ content: '❌ Member not found.', ephemeral: true });
      return;
    }

    const guild = client.guilds.get(interaction.guildId);
    if (!guild) {
      await interaction.reply({ content: '❌ Guild not found.', ephemeral: true });
      return;
    }

    const member = await guild.fetchMember(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: '❌ Member not in this server.', ephemeral: true });
      return;
    }

    // Build confirmation UI
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Issue Warning')
      .setDescription(`Are you sure you want to warn **${member.displayName}**?`)
      .addField('Reason', reason)
      .setColor(0xFFAA00)
      .setTimestamp();

    const confirmBtn = new ButtonBuilder()
      .setCustomId(`warn_confirm_${targetUser.id}_${Date.now()}`)
      .setLabel('✅ Confirm Warning')
      .setStyle(ButtonStyle.DANGER);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`warn_cancel_${Date.now()}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.SECONDARY);

    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    await interaction.reply({
      embeds: [embed.toJSON()],
      components: [row.toJSON()],
      ephemeral: true,
    });
  },
};

const kickCommand: Command = {
  name: 'kick',
  description: 'Kick a member from the server',
  options: [
    { name: 'member', description: 'The member to kick', type: 6, required: true },
    { name: 'reason', description: 'Reason for kicking', type: 3, required: false },
  ],
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ Server only.', ephemeral: true });
      return;
    }

    const perms = interaction.member?.permissions;
    if (!perms || !new PermissionsBitField(perms).has('KICK_MEMBERS')) {
      await interaction.reply({ content: '❌ You need **Kick Members** permission.', ephemeral: true });
      return;
    }

    const targetUser = interaction.getUser('member');
    const reason = interaction.getString('reason') ?? 'No reason provided';

    if (!targetUser) {
      await interaction.reply({ content: '❌ Member not found.', ephemeral: true });
      return;
    }

    const guild = client.guilds.get(interaction.guildId);
    if (!guild) {
      await interaction.reply({ content: '❌ Guild not found.', ephemeral: true });
      return;
    }

    const targetMember = await guild.fetchMember(targetUser.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: '❌ That user is not in this server.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Kick Confirmation')
      .setDescription(`Kick **${targetMember.displayName}**?`)
      .addField('Reason', reason)
      .setColor(0xFF9900)
      .setTimestamp();

    const confirmBtn = new ButtonBuilder()
      .setCustomId(`kick_confirm_${targetUser.id}_${Date.now()}`)
      .setLabel('✅ Confirm Kick')
      .setStyle(ButtonStyle.DANGER);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`kick_cancel_${Date.now()}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.SECONDARY);

    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    await interaction.reply({
      embeds: [embed.toJSON()],
      components: [row.toJSON()],
      ephemeral: true,
    });
  },
};

const serverinfoCommand: Command = {
  name: 'serverinfo',
  description: 'Display server information',
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ Server only.', ephemeral: true });
      return;
    }

    const guild = client.guilds.get(interaction.guildId);
    if (!guild) {
      await interaction.reply({ content: '❌ Guild not found.', ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await guild.fetch();
    await guild.fetchRoles();

    const owner = await guild.fetchOwner().catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setDescription(guild.description ?? 'No description set')
      .setColor(0x5865F2)
      .setThumbnail(guild.iconURL ?? undefined)
      .setImage(guild.bannerURL ?? undefined)
      .addFields(
        { name: '🆔 Server ID', value: guild.id, inline: true },
        { name: '👑 Owner', value: owner ? owner.toString() : guild.ownerId, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👥 Members', value: String(guild.memberCount), inline: true },
        { name: '💎 Boost Tier', value: `Tier ${guild.premiumTier}`, inline: true },
        { name: '🚀 Boosts', value: String(guild.premiumSubscriptionCount ?? 0), inline: true },
        { name: '📋 Channels', value: String(guild.channels.size), inline: true },
        { name: '🏷️ Roles', value: String(guild.roles.size), inline: true },
        { name: '🔒 Verification', value: getVerificationLevel(guild.verificationLevel), inline: true },
        { name: '✨ Features', value: guild.features.length > 0 ? guild.features.slice(0, 5).join(', ') : 'None' },
      )
      .setFooter({ text: `Requested by ${interaction.user?.username ?? 'Unknown'}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed.toJSON()] });
  },
};

const pingCommand: Command = {
  name: 'ping',
  description: 'Check bot latency',
  async execute(interaction) {
    const start = Date.now();
    await interaction.deferReply({ ephemeral: true });
    const latency = Date.now() - start;

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x00FF00)
      .addFields(
        { name: 'REST Latency', value: `${latency}ms`, inline: true },
        { name: 'WebSocket', value: `${client.shardManager?.getShard(0)?.ping ?? -1}ms`, inline: true },
        { name: 'Uptime', value: `<t:${Math.floor((Date.now() - process.uptime() * 1000) / 1000)}:R>`, inline: true },
      );

    await interaction.editReply({ embeds: [embed.toJSON()] });
  },
};

// ============================================================
// EVENT HANDLERS
// ============================================================

client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  console.log(`📊 Guilds: ${client.guilds.size} | Users: ${client.users.size} | Channels: ${client.channels.size}`);

  client.commands
    .add(userinfoCommand)
    .add(warnCommand)
    .add(kickCommand)
    .add(serverinfoCommand)
    .add(pingCommand);

  await client.commands.registerGlobally();
  console.log('📋 Slash commands registered globally');
});

// Friendly alias: 'message' instead of 'MESSAGE_CREATE'
client.on('message', (message: Message) => {
  if (message.author.bot) return;

  console.log(`[${message.guildId ?? 'DM'}] #${message.channelId} ${message.author.tag}: ${message.content}`);

  if (message.content === '!ping') {
    message.reply('🏓 Pong!');
  }

  if (message.content === '!react') {
    message.react('👍');
  }

  if (message.content === '!info') {
    const embed = new EmbedBuilder()
      .setTitle('ℹ️ Bot Info')
      .setColor(0x5865F2)
      .addFields(
        { name: 'Library', value: 'discord-light v2.0', inline: true },
        { name: 'Guilds', value: String(client.guilds.size), inline: true },
        { name: 'Users', value: String(client.users.size), inline: true },
      )
      .setTimestamp();

    message.reply({ embeds: [embed.toJSON()] });
  }
});

// Button interactions
client.on('interaction', async (interaction: Interaction) => {
  if (!interaction.isComponent) return;

  const customId = interaction.customId ?? '';

  // Warning confirmation
  if (customId.startsWith('warn_confirm_')) {
    await interaction.deferUpdate();
    const targetId = customId.split('_')[2];
    const guildId = interaction.guildId;
    if (!guildId || !targetId) return;

    const guild = client.guilds.get(guildId);
    if (!guild) {
      await interaction.editReply({ content: '❌ Guild not found.', embeds: [], components: [] });
      return;
    }

    const member = await guild.fetchMember(targetId).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: '❌ Member not found.', embeds: [], components: [] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Member Warned')
      .setDescription(`**${member.displayName}** has been warned by a moderator.`)
      .setColor(0xFFAA00)
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed.toJSON()], components: [] });
  }

  if (customId.startsWith('warn_cancel_')) {
    await interaction.update({ content: '❌ Warning cancelled.', embeds: [], components: [] });
  }

  // Kick confirmation
  if (customId.startsWith('kick_confirm_')) {
    await interaction.deferUpdate();
    const targetId = customId.split('_')[2];
    const guildId = interaction.guildId;
    if (!guildId || !targetId) return;

    const guild = client.guilds.get(guildId);
    if (!guild) {
      await interaction.editReply({ content: '❌ Guild not found.', embeds: [], components: [] });
      return;
    }

    const member = await guild.fetchMember(targetId).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: '❌ Member not found.', embeds: [], components: [] });
      return;
    }

    await member.kick('Confirmed by moderator via button');

    const embed = new EmbedBuilder()
      .setTitle('👢 Member Kicked')
      .setDescription(`**${member.displayName}** has been kicked from the server.`)
      .setColor(0xFF0000)
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed.toJSON()], components: [] });
  }

  if (customId.startsWith('kick_cancel_')) {
    await interaction.update({ content: '❌ Kick cancelled.', embeds: [], components: [] });
  }
});

// Friendly aliases
client.on('memberJoin', (data) => {
  console.log(`➕ ${data.user?.username} joined ${data.guild_id}`);
});

client.on('memberLeave', (data) => {
  console.log(`➖ ${data.user?.username} left ${data.guild_id}`);
});

client.on('error', (err) => {
  console.error('❌ Client error:', err);
});

client.on('shardFatal', (shardId, code, reason) => {
  console.error(`💀 Shard ${shardId} fatal: ${code} ${reason}`);
});

// ============================================================
// HELPERS
// ============================================================

function getVerificationLevel(level: number): string {
  const levels = ['None', 'Low', 'Medium', 'High', 'Very High'];
  return levels[level] ?? 'Unknown';
}

// ============================================================
// LOGIN
// ============================================================

client.login().catch((err) => {
  console.error('Failed to login:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down...');
  await client.destroy();
  process.exit(0);
});
