const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, 
    REST, Routes, SlashCommandBuilder, StringSelectMenuBuilder,
    MessageFlags 
} = require('discord.js');
const express = require('express');

// --- SERVEUR KEEP-ALIVE RENDER ---
const app = express();
app.get('/', (req, res) => res.send('Nae Bot Ultra est en ligne ! 🚀'));
app.listen(process.env.PORT || 10000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
    ]
});

// --- BASES DE DONNÉES TEMPORAIRES (RESET AU REDÉMARRAGE RENDER) ---
const xpMap = new Map();
const moneyMap = new Map();
const spamMap = new Map();

// --- CONFIGURATION ---
const COULEUR = '#5865F2';

// --- DÉFINITION DES COMMANDES ---
const commands = [
    // MODÉRATION
    new SlashCommandBuilder().setName('ban').setDescription('🔨 Bannir un membre').addUserOption(o => o.setName('cible').setDescription('Membre').setRequired(true)).addStringOption(o => o.setName('raison').setDescription('Raison')),
    new SlashCommandBuilder().setName('clear').setDescription('🧹 Nettoyer le chat').addIntegerOption(o => o.setName('nombre').setDescription('1-100').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('👢 Expulser un membre').addUserOption(o => o.setName('cible').setDescription('Membre').setRequired(true)),
    
    // SYSTÈMES PRO
    new SlashCommandBuilder().setName('setup-ticket').setDescription('📩 Installer le centre de support'),
    new SlashCommandBuilder().setName('verify-setup').setDescription('🤖 Installer le bouton de vérification'),
    
    // ÉCONOMIE & NIVEAUX
    new SlashCommandBuilder().setName('balance').setDescription('💰 Voir ton argent'),
    new SlashCommandBuilder().setName('rank').setDescription('📈 Voir ton niveau XP'),
    new SlashCommandBuilder().setName('daily').setDescription('🎁 Récupérer ton argent quotidien'),

    // UTILITAIRE & FUN
    new SlashCommandBuilder().setName('server-info').setDescription('📊 Statistiques du serveur'),
    new SlashCommandBuilder().setName('user-info').setDescription('👤 Infos sur un membre').addUserOption(o => o.setName('cible').setDescription('Le membre')),
    new SlashCommandBuilder().setName('8ball').setDescription('🔮 Question à la boule magique').addStringOption(o => o.setName('question').setRequired(true).setDescription('Ta question')),
    new SlashCommandBuilder().setName('pile-ou-face').setDescription('🪙 Tenter sa chance'),
].map(c => c.toJSON());

// --- INITIALISATION ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ Nae est prêt : ${client.user.tag}`);
    } catch (e) { console.error(e); }
});

// --- BIENVENUE & ANTI-RAID ---
client.on('guildMemberAdd', async (member) => {
    // Anti-Raid : Compte créé il y a moins de 48h
    if (Date.now() - member.user.createdTimestamp < 172800000) {
        return member.kick("Sécurité : Compte trop récent (moins de 48h).").catch(() => {});
    }

    const channel = member.guild.channels.cache.find(c => c.name === 'bienvenue');
    if (channel) {
        const welcome = new EmbedBuilder()
            .setTitle(`✨ Nouveau membre !`)
            .setDescription(`Bienvenue ${member} sur **${member.guild.name}** !\nUtilise le salon de vérification pour accéder au serveur.`)
            .setColor(COULEUR).setThumbnail(member.user.displayAvatarURL());
        channel.send({ embeds: [welcome] });
    }
});

// --- SYSTÈME XP & ÉCONOMIE & ANTI-SPAM ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;

    // 1. Système XP
    let userXP = xpMap.get(userId) || 0;
    xpMap.set(userId, userXP + Math.floor(Math.random() * 5) + 5);

    // 2. Anti-Spam (Mute 1min si > 5 msg en 5s)
    let userSpam = spamMap.get(userId) || { count: 0, timer: null };
    userSpam.count++;
    if (userSpam.count > 5) {
        await message.member.timeout(60000, "Spam automatique");
        message.channel.send(`⚠️ ${message.author}, calme-toi un peu ! (Mute 1min)`);
        userSpam.count = 0;
    }
    spamMap.set(userId, userSpam);
    setTimeout(() => spamMap.delete(userId), 5000);
});

// --- INTERACTIONS (COMMANDES & BOUTONS) ---
client.on('interactionCreate', async (interaction) => {
    const { commandName, options, guild, member, user } = interaction;

    if (interaction.isChatInputCommand()) {
        // --- ÉCONOMIE ---
        if (commandName === 'daily') {
            let lastDaily = moneyMap.get(user.id) || 0;
            moneyMap.set(user.id, lastDaily + 500);
            await interaction.reply(`🎁 Tu as reçu **500 coins** ! Ton nouveau solde : ${lastDaily + 500} 💰`);
        }

        if (commandName === 'balance') {
            const bal = moneyMap.get(user.id) || 0;
            await interaction.reply(`💰 Tu possèdes actuellement **${bal} coins**.`);
        }

        // --- NIVEAUX ---
        if (commandName === 'rank') {
            const xp = xpMap.get(user.id) || 0;
            const level = Math.floor(0.1 * Math.sqrt(xp));
            await interaction.reply(`📈 **Niveau :** ${level} | **XP :** ${xp}`);
        }

        // --- SYSTÈMES SETUP ---
        if (commandName === 'verify-setup') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('verify_btn').setLabel('Se vérifier').setStyle(ButtonStyle.Success).setEmoji('✅')
            );
            await interaction.reply({ content: "Cliquez sur le bouton pour prouver que vous n'êtes pas un robot :", components: [row] });
        }

        if (commandName === 'setup-ticket') {
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('tk_menu').setPlaceholder('Pourquoi ouvrez-vous un ticket ?')
                .addOptions([
                    { label: 'Devenir Modérateur', value: 'tk_modo', emoji: '👮' },
                    { label: 'Signaler un joueur', value: 'tk_report', emoji: '🚩' },
                    { label: 'Autre demande', value: 'tk_other', emoji: '❓' }
                ])
            );
            await interaction.reply({ content: "📩 **Centre de Support Nae**", components: [menu] });
        }

        // --- MODÉRATION ---
        if (commandName === 'clear') {
            const n = options.getInteger('nombre');
            await interaction.channel.bulkDelete(n, true);
            await interaction.reply({ content: `🧹 ${n} messages nettoyés.`, flags: [MessageFlags.Ephemeral] });
        }
    }

    // --- GESTION DES BOUTONS & MENUS ---
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_btn') {
            const role = guild.roles.cache.find(r => r.name === 'Vérifié' || r.name === 'Membre');
            if (role) {
                await member.roles.add(role);
                await interaction.reply({ content: "✅ Vous êtes maintenant vérifié !", flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.reply({ content: "❌ Erreur : Role 'Vérifié' introuvable.", flags: [MessageFlags.Ephemeral] });
            }
        }
        
        if (interaction.customId === 'close_tk') {
            await interaction.reply("🔒 Fermeture du ticket...");
            setTimeout(() => interaction.channel.delete(), 3000);
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'tk_menu') {
        const val = interaction.values[0];
        const ticketChan = await guild.channels.create({
            name: `${val}-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_tk').setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger)
        );
        await ticketChan.send({ content: `Bienvenue ${user}, le staff va vous aider pour : **${val}**`, components: [closeBtn] });
        await interaction.reply({ content: `✅ Ton ticket est ici : ${ticketChan}`, flags: [MessageFlags.Ephemeral] });
    }
});

client.login(process.env.TOKEN);
