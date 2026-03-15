const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, 
    REST, Routes, SlashCommandBuilder, StringSelectMenuBuilder 
} = require('discord.js');
const express = require('express');

// --- SERVEUR KEEP-ALIVE RENDER ---
const app = express();
app.get('/', (req, res) => res.send('Nae Bot Premium est en ligne ! 🚀'));
app.listen(process.env.PORT || 10000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
    ]
});

// --- CONFIGURATION ESTHÉTIQUE ---
const COULEUR_PRINCIPALE = '#5865F2'; // Bleu Discord
const COULEUR_SUCCES = '#2ECC71';     // Vert
const COULEUR_ERREUR = '#E74C3C';     // Rouge

// --- COMMANDES SLASH ---
const commands = [
    new SlashCommandBuilder().setName('ban').setDescription('🔨 Bannir un membre')
        .addUserOption(o => o.setName('cible').setDescription('Le membre à bannir').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du ban')),
    
    new SlashCommandBuilder().setName('clear').setDescription('🧹 Nettoyer le chat')
        .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages (1-100)').setRequired(true)),

    new SlashCommandBuilder().setName('setup-ticket').setDescription('📩 Installer le système de tickets pro'),
    
    new SlashCommandBuilder().setName('server-info').setDescription('📊 Afficher les stats du serveur'),
    
    new SlashCommandBuilder().setName('avatar').setDescription('🖼️ Voir l\'avatar d\'un membre')
        .addUserOption(o => o.setName('cible').setDescription('Le membre')),

    new SlashCommandBuilder().setName('8ball').setDescription('🔮 Pose une question à la boule magique')
        .addStringOption(o => o.setName('question').setDescription('Ta question').setRequired(true)),

    new SlashCommandBuilder().setName('pile-ou-face').setDescription('🪙 Lancer une pièce'),
].map(c => c.toJSON());

// --- INITIALISATION ---
client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✨ Commandes synchronisées avec succès !');
    } catch (e) { console.error(e); }
});

// --- BIENVENUE ESTHÉTIQUE ---
client.on('guildMemberAdd', async (member) => {
    // Anti-Raid : Compte de moins de 24h
    if (Date.now() - member.user.createdTimestamp < 86400000) {
        return member.kick("Anti-Raid : Compte trop récent (moins de 24h).").catch(() => {});
    }

    const channel = member.guild.channels.cache.find(c => c.name === 'bienvenue');
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`✨ Bienvenue sur ${member.guild.name} !`)
        .setDescription(`Ravi de t'accueillir **${member.user.username}** !\nPense à lire le règlement pour éviter les ennuis.`)
        .addFields({ name: '📊 Membres', value: `${member.guild.memberCount}`, inline: true })
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor(COULEUR_PRINCIPALE)
        .setImage('https://i.imgur.com/8PnV9os.png') // Image de bienvenue (optionnel)
        .setFooter({ text: 'Nae Bot • Sécurité Active' });

    channel.send({ content: `Bienvenue ${member} !`, embeds: [embed] });
});

// --- ANTI-SPAM & ANTI-INSULTES ---
const spamMap = new Map();
const motsInterdits = ['insulte1', 'insulte2', 'discord.gg/']; // À compléter

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Anti-Insultes
    if (motsInterdits.some(w => message.content.toLowerCase().includes(w))) {
        await message.delete().catch(() => {});
        return message.channel.send(`🚫 **${message.author.username}**, merci de rester poli.`).then(m => setTimeout(() => m.delete(), 3000));
    }

    // Anti-Spam
    if (!spamMap.has(message.author.id)) {
        spamMap.set(message.author.id, { count: 1 });
        setTimeout(() => spamMap.delete(message.author.id), 5000);
    } else {
        const data = spamMap.get(message.author.id);
        data.count++;
        if (data.count > 5) {
            await message.member.timeout(60000, 'Anti-Spam');
            message.channel.send(`⚠️ **${message.author.username}** a été mute 1 minute (Spam).`);
        }
    }
});

// --- GESTION DES INTERACTIONS ---
client.on('interactionCreate', async (interaction) => {
    
    // 1. COMMANDES SLASH
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member } = interaction;

        if (commandName === 'ban') {
            if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply({ content: "❌ Tu n'as pas la permission.", ephemeral: true });
            const cible = options.getMember('cible');
            const raison = options.getString('raison') || 'Aucune raison';
            await cible.ban({ reason: raison });
            await interaction.reply({ content: `🔨 **${cible.user.tag}** a été banni.\nRaison : ${raison}`, ephemeral: true });
        }

        if (commandName === 'clear') {
            const num = options.getInteger('nombre');
            await interaction.channel.bulkDelete(num, true);
            await interaction.reply({ content: `🧹 **${num}** messages ont été balayés !`, ephemeral: true });
        }

        if (commandName === 'server-info') {
            const embed = new EmbedBuilder()
                .setTitle(`📊 Stats de ${guild.name}`)
                .addFields(
                    { name: '👑 Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
                    { name: '📅 Création', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setThumbnail(guild.iconURL())
                .setColor(COULEUR_PRINCIPALE);
            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'setup-ticket') {
            const embed = new EmbedBuilder()
                .setTitle("📩 Centre d'Assistance Nae")
                .setDescription("Besoin d'aide ou envie de rejoindre l'équipe ?\nChoisissez une catégorie ci-dessous.")
                .setColor(COULEUR_PRINCIPALE)
                .setFooter({ text: 'Réponse rapide garantie' });

            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('menu_ticket')
                    .setPlaceholder('Sélectionnez un sujet...')
                    .addOptions([
                        { label: 'Devenir Modérateur', value: 'tk_modo', emoji: '👮', description: 'Postuler pour le staff' },
                        { label: 'Faire un Signalement', value: 'tk_report', emoji: '🚩', description: 'Signaler un joueur' },
                        { label: 'Aide Technique', value: 'tk_help', emoji: '🛠️', description: 'Problème serveur' }
                    ])
            );
            await interaction.reply({ embeds: [embed], components: [menu] });
        }

        // Mini-Jeux
        if (commandName === '8ball') {
            const reponses = ["Oui", "Non", "C'est possible", "Je ne sais pas", "Demande à ton chat", "Peut-être"];
            const r = reponses[Math.floor(Math.random() * reponses.length)];
            await interaction.reply(`🔮 **Question :** ${options.getString('question')}\n✨ **Boule Magique :** ${r}`);
        }
    }

    // 2. GESTION DES TICKETS (MENU)
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_ticket') {
        const val = interaction.values[0];
        const label = val === 'tk_modo' ? 'MODO' : val === 'tk_report' ? 'SIGNALEMENT' : 'AIDE';

        const channel = await interaction.guild.channels.create({
            name: `${label}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const embedTk = new EmbedBuilder()
            .setTitle(`🎫 Ticket ouvert : ${label}`)
            .setDescription(`Bonjour ${interaction.user}, explique-nous tout ici.\nUn membre du staff va s'occuper de toi.`)
            .setColor(COULEUR_SUCCES);

        const btnClose = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_tk').setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ embeds: [embedTk], components: [btnClose] });
        await interaction.reply({ content: `✅ Ticket créé : ${channel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'close_tk') {
        await interaction.reply("🔒 Fermeture du ticket dans 5 secondes...");
        setTimeout(() => interaction.channel.delete(), 5000);
    }
});

client.login(process.env.TOKEN);
