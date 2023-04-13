// TODO
// LEILÃO
// PROCURAR E CORRIGIR BUGS

const { Client, IntentsBitField } = require('discord.js');
require('dotenv').config();

const client = new Client({
intents: [
  IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildModeration,
    IntentsBitField.Flags.GuildEmojisAndStickers,
    IntentsBitField.Flags.GuildIntegrations,
    IntentsBitField.Flags.GuildWebhooks,
    IntentsBitField.Flags.GuildInvites,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildMessageTyping,
    IntentsBitField.Flags.MessageContent,
    ]
});

client.on('ready', () => {
    console.log(`Sock Fishing Game is online! ( ` + client.user.tag + ' )');
});

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const playerSchema = new mongoose.Schema({
  playerId: String,
  playerTag: String,
  socksFished: { type: Number, default: 0 },
  socksSold: { type: Number, default: 0 },
  money: { type: Number, default: 0 },
  inventory: { type: Array, default: [] },
  items: [String],
});

const Player = mongoose.model('Player', playerSchema);

const prefix = '?';

const rarities = [
  { name: 'Nigga', probability: 0.0809, price: 0 },
  { name: 'Common', probability: 0.409, price: 1 },
  { name: 'Uncommon', probability: 0.25, price: 2 },
  { name: 'Rare', probability: 0.2, price: 4 },
  { name: 'Epic', probability: 0.05, price: 15 },
  { name: 'Legendary', probability: 0.01, price: 100 },
  { name: 'Mythic', probability: 0.0001, price: 2500 }
];

const shopItems = [
  { name: 'Timeout Token 60sec', price: 100, type: 'timeoutToken60sec', duration: 60 },
  { name: 'Timeout Token 5min', price: 400, type: 'timeoutToken5min', duration: 300 },
  { name: 'Timeout Token 10min', price: 700, type: 'timeoutToken10min', duration: 600 },
  { name: 'Timeout Token 1hour', price: 3500, type: 'timeoutToken1hour', duration: 3600 },
  { name: 'Server Kick', price: 250, type: 'serverKick' },
  { name: 'Server Ban', price: 100000, type: 'serverBan' }
];

const cooldowns = new Set();

const weightedRandom = rarities => {
    const totalProbability = rarities.reduce((acc, rarity) => acc + rarity.probability, 0);
    const randomNum = Math.random() * totalProbability;
  
    //console.log("totalProbability:", totalProbability);
    //console.log("randomNum:", randomNum);
  
    let probabilitySum = 0;
    for (let i = 0; i < rarities.length; i++) {
      probabilitySum += rarities[i].probability;
      if (randomNum <= probabilitySum) {
        return i;
      }
    }
};
  
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) {
      return;
    }
  
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
  
    const playerId = message.author.id;
    const playerTag = message.author.tag;
    const player = await Player.findOne({ playerId });

    const roleNoBot = message.guild.roles.cache.find(role => role.name === 'L ROLE (No Fish For You)');

    if (message.member.roles.cache.has(roleNoBot.id)) {
      return message.reply('You cannot use bot commands nigga.');
    }
  
    if (!player) {
      await Player.create({ playerId, playerTag });
      return message.reply('Welcome to the fishing minigame!');
    }
  
    if (command === 'fish' || command === '🐟') {
      if (cooldowns.has(playerId)) {
        return message.reply('You need to wait before fishing again.');
      }
    
      cooldowns.add(playerId);
      setTimeout(() => {
        cooldowns.delete(playerId);
      }, 15000);
    
      const rarityIndex = weightedRandom(rarities);
      const sock = rarities[rarityIndex];
    
      if (sock) {
        player.socksFished++;
        player.inventory.push(sock.name);
        await player.updateOne({ inventory: player.inventory, money: player.money });
        await player.save();
        console.log(`Player ${playerTag} fished up a ${sock.name} sock.`);
        return message.reply(`You fished up a ${sock.name} sock! You can sell it for ${sock.price}$.`);
      } else {
        return message.reply('You fished and fished but caught nothing.');
      }
    }
      
    if (command === 'sell') {
      const { socksFished, money, inventory } = player;
    
      if (socksFished === 0) {
        return message.reply('You have no socks to sell!');
      }
    
      let totalPrice = 0;
    
      for (let i = 0; i < inventory.length; i++) {
        const rarity = rarities.find(rarity => rarity.name === inventory[i]);
        totalPrice += rarity.price / 2;
      }
    
      player.socksSold += socksFished;
      player.money += totalPrice;
      player.socksFished = 0;
      player.inventory = [];
      await player.save();
    
      return message.reply(`You sold ${socksFished} socks for ${totalPrice}$! You now have ${player.money}$.`);
    }
      
    if (command === 'shop') {
      return message.channel.send(`
        **Shop**
        Timeout Token 60sec - 100$
        Timeout Token 5min - 400$
        Timeout Token 10min - 700$
        Timeout Token 1hour - 3500$
        Server Kick - 250$
        Server Ban - 100000$
      `);
    }

    if (command === 'buy') {
      const itemName = args.join(' ').toLowerCase();
      const item = shopItems.find(i => i.name.toLowerCase() === itemName);
      
      if (!item) {
        return message.reply('That item is not available in the shop!');
      }
      
      const { money } = player;
      
      if (money < item.price) {
        return message.reply('You do not have enough money to buy that item!');
      }
      
      player.money -= item.price;
      
      if (item.type === 'timeoutToken60sec') {
        player.items.push('Timeout Token 60sec');
      } else if (item.type === 'timeoutToken5min') {
        player.items.push('Timeout Token 5min');
      } else if (item.type === 'timeoutToken10min') {
        player.items.push('Timeout Token 10min');
      } else if (item.type === 'timeoutToken1hour') {
        player.items.push('Timeout Token 1hour');
      } else if (item.type === 'serverKick') {
        player.items.push('Server Kick');
      } else if (item.type === 'serverBan') {
        player.items.push('Server Ban');
      }
      
      await player.save({ items: player.items });
      
      return message.reply(`You bought ${item.name} for ${item.price}$.`);
    }

    if (command === 'info') {

      let targetPlayer;

      const mention = message.mentions.members.first();

      if (mention && mention.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${mention} cause he is a nigga.`);
      }

      if (!mention) {
        targetPlayer = player;

        const { socksFished, socksSold, money } = targetPlayer;

        return message.channel.send(`
        **Info**
        Socks Fished: ${socksFished}
        Socks Sold: ${socksSold}
        Money: ${money}$
        `);

      } else {

        const playerGetPing = message.mentions.members.first();
        const playerPingId = playerGetPing.id;

        if (!playerPingId) {
          return message.channel.send('Could not find player with that name.');
        }

        const playerPingFind = await Player.findOne({ playerId: playerPingId });

        targetPlayer = playerPingFind;

        const { socksFished, socksSold, money } = targetPlayer;

        return message.channel.send(`
        **Info**
        Socks Fished: ${socksFished}
        Socks Sold: ${socksSold}
        Money: ${money}$
        `);
      }
    }

    if (command === 'kick') {
      const { items } = player;
      const hasKick = items.includes('Server Kick');
    
      if (!hasKick) {
        return message.reply('You do not have a server kick item!');
      }
    
      const mention = message.mentions.members.first();

      if (mention.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${mention} cause he is a nigga.`);
      }
      
      if (!mention) {
        return message.reply('You need to mention a user to kick!');
      }
    
      mention.kick('You have been kicked!').then(() => {
        message.channel.send(`${mention} has been kicked from the server!`);
        console.log(`${player} kicked ${mention} from the server.`);
        const index = items.indexOf('Server Kick');
        player.items.splice(index, 1);
        player.save();
      }).catch(err => {
        console.error(err);
        message.reply('An error occurred while trying to kick the user.');
      });
    }

    if (command === 'ban') {
      const { items } = player;
      const hasBan = items.includes('Server Ban');
    
      if (!hasBan) {
        return message.reply('You do not have a server ban item!');
      }
    
      const mention = message.mentions.members.first();

      if (mention.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${mention} cause he is a nigga.`);
      }
      
      if (!mention) {
        return message.reply('You need to mention a user to ban!');
      }
    
      mention.ban({ reason: 'You have been banned!' }).then(() => {
        message.channel.send(`${mention} has been banned from the server!`);
        console.log(`${player} banned ${mention} from the server.`);
        const index = items.indexOf('Server Ban');
        player.items.splice(index, 1);
        player.save();
      }).catch(err => {
        console.error(err);
        message.reply('An error occurred while trying to ban the user.');
      });
    }

    const roleId = '1095683693483397180';

    if (command === 'timeout60sec') {
      const { items } = player;
      const hasTimeout = items.includes('Timeout Token 60sec');
    
      if (!hasTimeout) {
        return message.reply('You do not have a 60 seconds timeout token item!');
      }
    
      const mention = message.mentions.members.first();

      if (mention.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${mention} cause he is a nigga.`);
      }
    
      if (!mention) {
        return message.reply('You need to mention a user to timeout!');
      }

      message.member.roles.add(roleId);

      duration = 60 * 1000;
    
      mention.timeout(duration, 'You have been timeouted!').then(() => {
        message.channel.send(`${mention} has been timed out for 60 seconds!`);
        console.log(`${playerTag} timeouted ${mention} for 60sec.`);
        const index = items.indexOf('Timeout Token 60sec');
        player.items.splice(index, 1);
        player.save();
      }).catch(err => {
        console.error(err);
        message.reply('An error occurred while trying to timeout the user.');
      });

      setTimeout(() => {
        message.member.roles.remove(roleId);
      }, 500);
    }

    if (command === 'timeout5min') {
      const { items } = player;
      const hasTimeoutToken = items.includes('Timeout Token 5min');
    
      if (!hasTimeoutToken) {
        return message.reply('You do not have a 5 minutes timeout token item!');
      }
    
      const mention = message.mentions.members.first();

      if (mention.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${mention} cause he is a nigga.`);
      }
    
      if (!mention) {
        return message.reply('You need to mention a user to timeout!');
      }

      message.member.roles.add(roleId);

      duration = 5 * 60 * 1000;
    
      mention.timeout(duration, 'You have been timeouted!').then(() => {
        message.channel.send(`${mention} has been timed out for 5 minutes!`);
        console.log(`${playerTag} timeouted ${mention} for 5min.`);
        const index = items.indexOf('Timeout Token 5min');
        player.items.splice(index, 1);
        player.save();
      }).catch(err => {
        console.error(err);
        message.reply('An error occurred while trying to timeout the user.');
      });

      setTimeout(() => {
        message.member.roles.remove(roleId);
      }, 500);
    }

    if (command === 'timeout10min') {
      const { items } = player;
      const hasTimeoutToken = items.includes('Timeout Token 10min');
    
      if (!hasTimeoutToken) {
        return message.reply('You do not have a 10 minutes timeout token item!');
      }
    
      const mention = message.mentions.members.first();

      if (mention.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${mention} cause he is a nigga.`);
      }
    
      if (!mention) {
        return message.reply('You need to mention a user to timeout!');
      }

      message.member.roles.add(roleId);

      duration = 10 * 60 * 1000;
    
      mention.timeout(duration, 'You have been timeouted!').then(() => {
        message.channel.send(`${mention} has been timed out for 10 minutes!`);
        console.log(`${playerTag} timeouted ${mention} for 10min.`);
        const index = items.indexOf('Timeout Token 10min');
        player.items.splice(index, 1);
        player.save();
      }).catch(err => {
        console.error(err);
        message.reply('An error occurred while trying to timeout the user.');
      });

      setTimeout(() => {
        message.member.roles.remove(roleId);
      }, 500);
    }

    if (command === 'timeout1hour') {
      const { items } = player;
      const hasTimeoutToken = items.includes('Timeout Token 1hour');
    
      if (!hasTimeoutToken) {
        return message.reply('You do not have a 1 hour timeout token item!');
      }
    
      const mention = message.mentions.members.first();

      if (mention.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${mention} cause he is a nigga.`);
      }
    
      if (!mention) {
        return message.reply('You need to mention a user to timeout!');
      }

      message.member.roles.add(roleId);

      duration = 60 * 60 * 1000;
    
      mention.timeout(duration, 'You have been timeouted!').then(() => {
        message.channel.send(`${mention} has been timed out for 1 hour!`);
        console.log(`${playerTag} timeouted ${mention} for 1 hour.`);
        const index = items.indexOf('Timeout Token 1 hour');
        player.items.splice(index, 1);
        player.save();
      }).catch(err => {
        console.error(err);
        message.reply('An error occurred while trying to timeout the user.');
      });

      setTimeout(() => {
        message.member.roles.remove(roleId);
      }, 500);
    }

    if (command === 'leaderboardmoney') {
      const players = await Player.find().sort({ money: -1 });
    
      if (!players.length) {
        return message.reply('No players found!');
      }
    
      const leaderboard = players
        .map((player, index) => `${index + 1}. ${player.playerTag} - ${player.money}$`)
        .join('\n');
    
      return message.channel.send(`**Money Leaderboard**:\n${leaderboard}`);
    }

    if (command === 'leaderboardsocks') {
      const players = await Player.find().sort({ socksSold: -1, socksFished: -1 });
    
      if (!players.length) {
        return message.reply('No players found!');
      }
    
      const leaderboard = players
        .map((player, index) => `${index + 1}. ${player.playerTag} - ${player.socksSold + player.socksFished}`)
        .join('\n');
    
      return message.channel.send(`**Socks Leaderboard**:\n${leaderboard}`);
    }

    if (command === 'rarities') {
      return message.channel.send(`
        **Rarities**
        Nigga - 8.09% - 0$
        Common - 40.9% - 1$
        Uncommon - 25% - 2$
        Rare - 20% - 5$
        Epic - 5% - 15$
        Legendary - 1% - 100$
        Mythical - 0.01% - 2500$
      `);
    }

    if (command === 'send') {
      const receiver = message.mentions.members.first();

      if (receiver.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${receiver} cause he is a nigga.`);
      }

      if (!receiver) {
        return message.reply('Please mention a valid player to send money to.');
      }
    
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) {
        return message.reply('Please enter a valid amount of money to send.');
      }
    
      if (player.money < amount) {
        return message.reply('You do not have enough money to complete this transaction.');
      }
    
      const receiverPlayer = await Player.findOne({ playerId: receiver.user.id }); //FIX INFO CRASHING BOT WHEN PININGING NON REGISTERED USER IN DATABASE
      if (!receiverPlayer) {
        return message.reply(`${receiver} has not played the game yet.`); // MENTION PLAYER ( MAY WORK )
      }
    
      player.money -= amount;
      receiverPlayer.money += amount;
    
      await player.save();
      await receiverPlayer.save();
    
      return message.reply(`You have sent ${amount}$ to ${receiver.user}.`);
    }

    if (command === 'help') {
      return message.channel.send(`
        **Commands**
        ?fish - Fish socks
        ?sell - Sell your socks
        ?shop - Show the shop items
        ?buy <item> - Buy an item from the shop
        ?timeout60sec <@user> - Use a Timeout Token 60sec to timeout a user
        ?timeout5min <@user> - Use a Timeout Token 5min to timeout a user
        ?timeout10min <@user> - Use a Timeout Token 10min to timeout a user
        ?timeout1hour <@user> - Use a Timeout Token 1hour to timeout a user
        ?info <@user> - Show your player info
        ?leaderboardmoney - Show money leaderboard
        ?leaderboardsocks - Show sock leaderboard
        ?rarities - Show socks info
        ?send <ammount> <@user> - Give the mentioned user the selected ammount of money
        ?coinflip <ammount> <@user> - Challanges the mentioned player for a coinflip
        ?help - Show this message
      `);
    }

    if (command === 'coinflip') {
      const opponent = message.mentions.members.first();

      if (opponent.roles.cache.has(roleNoBot.id)) {
        return message.reply(`You cannot use bot commands on ${opponent} cause he is a nigga.`);
      }

      if (!opponent) {
        return message.reply('Please mention someone to challenge!');
      }

      const betAmount = parseInt(args[0]);
      if (!betAmount || betAmount <= 0) {
        return message.reply('Please provide a valid bet amount!');
      }
    
      if (player.money < betAmount) {
        return message.reply(`You don't have enough money to bet ${betAmount}$!`);
      }
      const opponentId = opponent.id;
      const opponentTag = opponent.tag;
      const opponentPlayer = await Player.findOne({ playerId: opponentId });
      if (!opponentPlayer) {
        await Player.create({ playerId: opponentId, playerTag: opponentTag }); // WHY CREATE
        return message.reply(`${opponent} doesn't have a player profile yet.`);
      }
      if (playerId === opponentId) {
        return message.reply(`You can't challange yourself.`)
      }
      if (opponentPlayer.money < betAmount) {
        return message.reply(`${opponent} doesn't have enough money to bet ${betAmount}$!`);
      }

      const filter = (reaction, user) => {
        return ['✅', '❌'].includes(reaction.emoji.name) && user.id === opponent.id;
      };
      const challengeMsg = await message.channel.send(`Hey ${opponent}, ${message.author.username} has challenged you to a coinflip! React with ✅ to accept the challenge, or ❌ to decline.`);
      await challengeMsg.react('✅');
      await challengeMsg.react('❌');
      try {
        const reaction = await challengeMsg.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
        const accepted = reaction.first().emoji.name === '✅';
        if (!accepted) {
          return message.channel.send(`${opponent} has declined the challenge.`);
        }
      } catch (err) {
        return message.channel.send(`${opponent} didn't respond to the challenge.`);
      }
    
      const coin = Math.random() < 0.5 ? 'heads' : 'tails';
      console.log(coin);
      let winner, loser;
      if (coin === 'heads') {
        winner = player;
        loser = opponentPlayer;
      } else {
        winner = opponentPlayer;
        loser = player;
      }
    
      winner.money += betAmount;
      loser.money -= betAmount;
      await winner.save();
      await loser.save();
    
      const resultMessage = `The coin landed on ${coin}! ${winner.playerTag} won ${betAmount}$ from ${loser.playerTag}.`;
      message.channel.send(resultMessage);
    }

});

client.login(process.env.TOKEN);
