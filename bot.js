const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const express = require('express');

// --- CONFIGURATION SERVEUR RENDER ---
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Bot Nae est en ligne !');
});

app.listen(port, () => {
    console.log(`Serveur Web activé sur le port ${port}`);
});

// --- CONFIGURATION DU BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Système de Bienvenue
client.on('guildMemberAdd', (member) => {
    const channel = member.guild.channels.cache.find(c => c.name === 'bienvenue');
    if (channel) {
        channel.send(`Bienvenue sur le serveur, ${member} ! 🎉`);
    }
});

// Système de Commandes & Tickets
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        // Commande /ban
        if (interaction.commandName === 'ban') {
            const target = interaction.options.getMember('cible');
            const reason = interaction.options.getString('raison') || 'Aucune raison';
            
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({ content: "Tu n'as pas la permission !", ephemeral: true });
            }

            await target.ban({ reason });
            await interaction.reply({ content: `✅ ${target.user.tag} a été banni pour : ${reason}`, ephemeral: true });
        }

        // Commande /setup-ticket
        if (interaction.commandName === 'setup-ticket') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Ouvrir un Ticket')
                    .setStyle(ButtonStyle.Primary)
            );
            await interaction.reply({ content: 'Cliquez ci-dessous pour contacter le staff :', components: [row] });
        }
    }

    // Gestion des Tickets par bouton
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            ],
        });
        await interaction.reply({ content: `Ticket créé : ${ticketChannel}`, ephemeral: true });
    }
});

// On utilise la variable d'environnement de Render
client.login(process.env.TOKEN);
