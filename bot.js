const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, 
    REST, Routes, SlashCommandBuilder, StringSelectMenuBuilder,
    MessageFlags, ActivityType 
} = require('discord.js');
const express = require('express');

// --- SERVEUR KEEP-ALIVE (IMPORTANT POUR RENDER) ---
const app = express();
app.get('/', (req, res) => res.send('Nae Bot Ultra-Core est prêt ! 🚀'));
app.listen(process.env.PORT || 10000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ]
});

// --- BASES DE DONNÉES TEMPORAIRES (RESET AU REBOOT) ---
const db = { xp: new Map(), money: new Map(), daily: new Map(), warn: new Map() };
const COULEUR = '#5865F2';

// --- RÉPERTOIRE DES COMMANDES SLASH ---
const commands = [
    // MODÉRATION
    new SlashCommandBuilder().setName('ban').setDescription('🔨 Bannir un membre').addUserOption(o => o.setName('cible').setRequired(true).setDescription('Le membre')).addStringOption(o => o.setName('raison').setDescription('Raison')),
    new SlashCommandBuilder().setName('kick').setDescription('👢 Expulser un membre').addUserOption(o => o.setName('cible').setRequired(true).setDescription('Le membre')),
    new SlashCommandBuilder().setName('clear').setDescription('🧹 Nettoyer le chat').addIntegerOption(o => o.setName('nombre').setRequired(true).setDescription('1-100')),
    new SlashCommandBuilder().setName('warn').setDescription('⚠️ Avertir un membre').addUserOption(o => o.setName('cible').setRequired(true).setDescription('Le membre')).addStringOption(o => o.setName('raison').setDescription('Raison')),
    
    // CYBER-SÉCURITÉ & INVESTIGATION
    new SlashCommandBuilder().setName('inspect').setDescription('🔍 Analyse profonde (Staff Only)').addUserOption(o => o.setName('cible').setRequired(true).setDescription('Le membre')).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('lockdown').setDescription('🔒 Verrouiller le serveur').addBooleanOption(o => o.setName('etat').setRequired(true).setDescription('On/Off')).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // CONFIGURATION ESTHÉTIQUE
    new SlashCommandBuilder().setName('setup-roles').setDescription('🎭 Menu des rôles esthétique'),
    new SlashCommandBuilder().setName('setup-ticket').setDescription('📩 Système de tickets pro'),
    new SlashCommandBuilder().setName('verify-setup').setDescription('🤖 Système de vérification anti-bot'),

    // ÉCONOMIE & NIVEAUX
    new SlashCommandBuilder().setName('balance').setDescription('💰 Voir son portefeuille'),
    new SlashCommandBuilder().setName('daily').setDescription('🎁 Récupérer sa récompense journalière'),
    new SlashCommandBuilder().setName('rank').setDescription('📈 Voir son niveau XP'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top des joueurs'),

    // FUN & UTILITAIRE
    new SlashCommandBuilder().setName('8ball').setDescription('🔮 Boule magique').addStringOption(o => o.setName('question').setRequired(true).setDescription('Ta question')),
    new SlashCommandBuilder().setName('avatar').setDescription('🖼️ Voir l\'avatar d\'un membre').addUserOption(o => o.setName('cible').setDescription('Le membre')),
    new SlashCommandBuilder().setName('server-info').setDescription('📊 Statistiques du serveur'),
].map(c => c.toJSON());

// --- INITIALISATION DU BOT ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ [SYSTEM] Nae connecté sous ${client.user.tag}`);
        client.user.setActivity('Protéger le serveur', { type: ActivityType.Shield });
    } catch (e) { console.error(e); }
});

// --- SYSTÈME XP & ÉCONOMIE PAR MESSAGE ---
client.on('messageCreate', (m) => {
    if (m.author.bot || !m.guild) return;
    
    // XP
    let xp = db.xp.get(m.author.id) || 0;
    db.xp.set(m.author.id, xp + Math.floor(Math.random() * 7) + 3);

    // Argent aléatoire (1 chance sur 10)
    if (Math.random() < 0.1) {
        let bal = db.money.get(m.author.id) || 0;
        db.money.set(m.author.id, bal + 10);
    }
});
// --- SYSTÈME DE LOGS D'AUDIT (CYBER-SÉCURITÉ) ---

// 1. Logs de Connexion (Qui arrive ?)
client.on('guildMemberAdd', async (member) => {
    const embed = new EmbedBuilder()
        .setTitle('📥 Nouveau Membre')
        .setColor('#2ECC71')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'Utilisateur', value: `${member.user.tag}`, inline: true },
            { name: 'ID', value: `\`${member.id}\``, inline: true },
            { name: 'Âge du compte', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false }
        )
        .setTimestamp();
    sendLog(member.guild, embed);
});

// 2. Logs de Déconnexion (Qui part ?)
client.on('guildMemberRemove', async (member) => {
    const embed = new EmbedBuilder()
        .setTitle('📤 Départ Membre')
        .setColor('#E74C3C')
        .setDescription(`**${member.user.tag}** a quitté le serveur.`)
        .setTimestamp();
    sendLog(member.guild, embed);
});

// 3. Logs de Suppression (Anti-Ghosting)
client.on('messageDelete', async (message) => {
    if (message.author?.bot || !message.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Supprimé')
        .setColor('#FF9500')
        .addFields(
            { name: 'Auteur', value: `${message.author.tag}`, inline: true },
            { name: 'Salon', value: `${message.channel}`, inline: true },
            { name: 'Contenu', value: message.content || "*Fichier/Image*" }
        )
        .setFooter({ text: `ID Message: ${message.id}` })
        .setTimestamp();
    sendLog(message.guild, embed);
});

// 4. Logs de Modification (Traçabilité)
client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    const embed = new EmbedBuilder()
        .setTitle('📝 Message Modifié')
        .setColor('#F1C40F')
        .addFields(
            { name: 'Auteur', value: `${oldMsg.author.tag}`, inline: false },
            { name: 'Ancien contenu', value: oldMsg.content || "*Vide*" },
            { name: 'Nouveau contenu', value: newMsg.content || "*Vide*" }
        )
        .setTimestamp();
    sendLog(oldMsg.guild, embed);
});

// --- FONCTION AUTOMATIQUE D'ENVOI ---
async function sendLog(guild, embed) {
    const logChannel = guild.channels.cache.find(c => c.name === 'logs-nae');
    if (logChannel) {
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
}

// --- GESTION DES LOGS D'AUDIT (SUPPRESSION) ---
client.on('messageDelete', async (m) => {
    const logs = m.guild.channels.cache.find(c => c.name === 'logs-nae');
    if (!logs || !m.content) return;
    const embed = new EmbedBuilder().setTitle('🗑️ Message Supprimé').setColor('#E74C3C')
        .addFields({ name: 'Auteur', value: `${m.author.tag}`, inline: true }, { name: 'Salon', value: `${m.channel}`, inline: true }, { name: 'Message', value: m.content })
        .setTimestamp();
    logs.send({ embeds: [embed] });
});

// --- GESTION DES INTERACTIONS ---
client.on('interactionCreate', async (i) => {
    const { commandName, options, guild, member, user, customId } = i;

    if (i.isChatInputCommand()) {
        // --- ÉCONOMIE ---
        if (commandName === 'daily') {
            const now = Date.now();
            const last = db.daily.get(user.id) || 0;
            if (now - last < 86400000) return i.reply({ content: "❌ Reviens demain !", flags: [MessageFlags.Ephemeral] });
            db.daily.set(user.id, now);
            db.money.set(user.id, (db.money.get(user.id) || 0) + 200);
            i.reply("🎁 Tu as reçu **200 coins** !");
        }

        if (commandName === 'rank') {
            const xp = db.xp.get(user.id) || 0;
            const lvl = Math.floor(0.1 * Math.sqrt(xp));
            i.reply(`📈 **${user.username}**, tu es Niveau **${lvl}** (${xp} XP).`);
        }

        // --- CYBER-SÉCURITÉ / INSPECT ---
        if (commandName === 'inspect') {
            const target = options.getUser('cible');
            const targetM = options.getMember('cible');
            const isNew = (Date.now() - target.createdTimestamp) < 604800000;
            const embed = new EmbedBuilder().setTitle(`🔍 Investigation : ${target.username}`).setColor(isNew ? '#FF0000' : '#00FF00')
                .addFields(
                    { name: '🆔 ID', value: `\`${target.id}\``, inline: true },
                    { name: '🚩 Risque', value: isNew ? 'Élevé (Compte récent)' : 'Faible', inline: true },
                    { name: '📅 Créé le', value: `<t:${Math.floor(target.createdTimestamp/1000)}:F>`, inline: false },
                    { name: '📥 Joint le', value: `<t:${Math.floor(targetM.joinedTimestamp/1000)}:R>`, inline: true }
                ).setThumbnail(target.displayAvatarURL());
            i.reply({ embeds: [embed] });
        }

        // --- SETUP ROLES (ESTHÉTIQUE MAXIMALE) ---
        if (commandName === 'setup-roles') {
            const embed = new EmbedBuilder()
                .setTitle('🎭 Personnalisation du Profil')
                .setDescription('Cliquez sur les boutons pour définir qui vous êtes !')
                .setColor(COULEUR).setImage('https://i.imgur.com/vHq0L5p.png');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_PC').setLabel('PC').setStyle(ButtonStyle.Secondary).setEmoji('💻'),
                new ButtonBuilder().setCustomId('role_PS5').setLabel('Console').setStyle(ButtonStyle.Secondary).setEmoji('🎮'),
                new ButtonBuilder().setCustomId('role_Mobile').setLabel('Mobile').setStyle(ButtonStyle.Secondary).setEmoji('📱')
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_Homme').setLabel('Homme').setStyle(ButtonStyle.Primary).setEmoji('👨'),
                new ButtonBuilder().setCustomId('role_Femme').setLabel('Femme').setStyle(ButtonStyle.Primary).setEmoji('👩')
            );
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_Mineur').setLabel('-18 ans').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('role_Majeur').setLabel('+18 ans').setStyle(ButtonStyle.Success)
            );
            i.reply({ embeds: [embed], components: [row1, row2, row3] });
        }

        // --- TICKETS PRO ---
        if (commandName === 'setup-ticket') {
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('tk_menu').setPlaceholder('Pourquoi ouvrez-vous un ticket ?')
                .addOptions([
                    { label: 'Modération', value: 'tk_mod', emoji: '🔨' },
                    { label: 'Candidature', value: 'tk_staff', emoji: '📝' },
                    { label: 'Bug/Aide', value: 'tk_help', emoji: '🆘' }
                ])
            );
            i.reply({ content: "📩 **Besoin d'aide ? Utilisez le menu ci-dessous.**", components: [row] });
        }

        // --- MODÉRATION ---
        if (commandName === 'clear') {
            const n = options.getInteger('nombre');
            await i.channel.bulkDelete(n, true);
            i.reply({ content: `🧹 **${n}** messages supprimés !`, flags: [MessageFlags.Ephemeral] });
        }
    }

    // --- LOGIQUE DES BOUTONS DE RÔLES ---
    if (i.isButton() && customId.startsWith('role_')) {
        const rName = customId.split('_')[1];
        const role = guild.roles.cache.find(r => r.name === rName);
        if (!role) return i.reply({ content: `❌ Rôle **${rName}** introuvable !`, flags: [MessageFlags.Ephemeral] });

        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            i.reply({ content: `➖ Rôle **${rName}** retiré.`, flags: [MessageFlags.Ephemeral] });
        } else {
            await member.roles.add(role);
            i.reply({ content: `➕ Rôle **${rName}** ajouté !`, flags: [MessageFlags.Ephemeral] });
        }
    }

    // --- LOGIQUE DES TICKETS (SELECT MENU) ---
    if (i.isStringSelectMenu() && customId === 'tk_menu') {
        const type = i.values[0];
        const channel = await guild.channels.create({
            name: `${type}-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_tk').setLabel('Fermer').setStyle(ButtonStyle.Danger));
        await channel.send({ content: `Bonjour ${user}, un membre du staff arrive pour votre ticket : **${type}**`, components: [closeBtn] });
        i.reply({ content: `✅ Ticket ouvert : ${channel}`, flags: [MessageFlags.Ephemeral] });
    }

    if (i.isButton() && customId === 'close_tk') {
        await i.reply("🔒 Fermeture...");
        setTimeout(() => i.channel.delete(), 3000);
    }
});

client.login(process.env.TOKEN);
