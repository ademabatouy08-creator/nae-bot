const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, 
    REST, Routes, SlashCommandBuilder 
} = require('discord.js');
const express = require('express');

// --- SERVEUR POUR RENDER (KEEP ALIVE) ---
const app = express();
app.get('/', (req, res) => res.send('Bot Nae Ultra est en ligne !'));
app.listen(process.env.PORT || 10000);

// --- CONFIGURATION ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
    ]
});

// --- DÉFINITION DES COMMANDES (SLASH) ---
const commands = [
    new SlashCommandBuilder().setName('ban').setDescription('Bannir un membre')
        .addUserOption(o => o.setName('cible').setDescription('Le membre').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('La raison'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    new SlashCommandBuilder().setName('clear').setDescription('Supprimer des messages')
        .addIntegerOption(o => o.setName('nombre').setDescription('Nombre (1-100)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder().setName('kick').setDescription('Expulser un membre')
        .addUserOption(o => o.setName('cible').setDescription('Le membre').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder().setName('server-info').setDescription('Affiche les stats du serveur'),

    new SlashCommandBuilder().setName('setup-ticket').setDescription('Installer le système de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

// --- SYSTÈME DE LOGS RAPIDE ---
async function sendLog(guild, title, desc, color = '#ff0000') {
    const logChan = guild.channels.cache.find(c => c.name === 'logs-nae');
    if (!logChan) return;
    const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setTimestamp();
    logChan.send({ embeds: [embed] });
}

// --- ÉVÉNEMENT : READY ---
client.once('ready', async () => {
    console.log(`Nae Bot connecté : ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Commandes synchronisées !');
    } catch (e) { console.error(e); }
});

// --- AUTO-MOD & ANTI-INSULTES ---
const motsInterdits = ['insulte1', 'insulte2', 'discord.gg/']; // Ajoute tes mots ici
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // 1. Détection mots interdits / liens
    if (motsInterdits.some(mot => message.content.toLowerCase().includes(mot))) {
        await message.delete().catch(() => {});
        return message.channel.send(`🚫 ${message.author}, attention à ton langage ou aux liens !`).then(m => setTimeout(() => m.delete(), 3000));
    }

    // 2. Auto-Réponse fun
    if (message.content.toLowerCase() === 'ping') message.reply('Pong ! 🏓');
});

// --- BIENVENUE AVEC EMBED ---
client.on('guildMemberAdd', (member) => {
    const channel = member.guild.channels.cache.find(c => c.name === 'bienvenue');
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`Bienvenue sur ${member.guild.name} !`)
            .setDescription(`Salut ${member}, n'oublie pas de prendre tes rôles !`)
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: `Nous sommes maintenant ${member.guild.memberCount}` });
        channel.send({ embeds: [embed] });
    }
    sendLog(member.guild, "📥 Nouveau Membre", `${member.user.tag} a rejoint le serveur.`, '#00ff00');
});

// --- INTERACTIONS (COMMANDES & BOUTONS) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild } = interaction;

        if (commandName === 'ban') {
            const user = options.getMember('cible');
            await user.ban();
            await interaction.reply(`🔨 Banni : ${user.user.tag}`);
            sendLog(guild, "🔨 Banissement", `${user.user.tag} a été banni par ${interaction.user.tag}`);
        }

        if (commandName === 'server-info') {
            const embed = new EmbedBuilder()
                .setTitle(guild.name)
                .addFields(
                    { name: 'Membres', value: `${guild.memberCount}`, inline: true },
                    { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true }
                )
                .setThumbnail(guild.iconURL());
            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'setup-ticket') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tk_create').setLabel('Besoin d\'aide ?').setStyle(ButtonStyle.Success).setEmoji('🆘')
            );
            await interaction.reply({ content: "**Support Technique Nae**", components: [row] });
        }
        
        // Commande Clear
        if (commandName === 'clear') {
            const amount = options.getInteger('nombre');
            await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({ content: `✅ ${amount} messages nettoyés.`, ephemeral: true });
        }
    }

    // GESTION BOUTONS TICKETS
    if (interaction.isButton()) {
        if (interaction.customId === 'tk_create') {
            const ticket = await interaction.guild.channels.create({
                name: `aide-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tk_close').setLabel('Fermer').setStyle(ButtonStyle.Danger)
            );
            await ticket.send({ content: `Bonjour ${interaction.user}, explique ton problème ici.`, components: [row] });
            await interaction.reply({ content: `Ton ticket est ouvert ici : ${ticket}`, ephemeral: true });
            sendLog(interaction.guild, "📩 Ticket Ouvert", `Par : ${interaction.user.tag}`, '#3498db');
        }

        if (interaction.customId === 'tk_close') {
            await interaction.reply("Fermeture dans 5 secondes...");
            setTimeout(() => interaction.channel.delete(), 5000);
        }
    }
});

client.login(process.env.TOKEN);
