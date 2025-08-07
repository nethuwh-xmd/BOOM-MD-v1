const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const P = require('pino');
const { loadPlugins } = require('./lib/loader');
require('dotenv').config();

const LOGGED_IMAGE = 'https://files.catbox.moe/fge8q7.jpg';
const MENU_IMAGE = 'https://files.catbox.moe/4ior1g.jpg';
const ALIVE_IMAGE = 'https://files.catbox.moe/pgcxfy.jpg';

async function startBoomMdV3() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger: P({ level: 'silent' }),
    defaultQueryTimeoutMs: undefined,
  });

  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log('Bot disconnected. Scan again.');
        process.exit();
      } else {
        startBoomMdV3();
      }
    } else if (connection === 'open') {
      console.log('✅ BOOM-MD-V3 Connected Successfully!');
      await conn.sendMessage(conn.user.id, {
        image: { url: LOGGED_IMAGE },
        caption: `🎉 *BOOM-MD-V3 Connected Successfully!*`,
      });
    }
  });

  conn.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    const body = m.message.conversation || m.message.extendedTextMessage?.text || '';

    const sender = m.key.remoteJid;
    const fromMe = m.key.fromMe;

    // Sample Commands
    if (body === '.alive') {
      await conn.sendMessage(sender, {
        image: { url: ALIVE_IMAGE },
        caption: `👋 I'm *BOOM-MD-V3* and I'm online!`,
      }, { quoted: m });
    }

    if (body === '.menu') {
      await conn.sendMessage(sender, {
        image: { url: MENU_IMAGE },
        caption: `📜 *BOOM-MD-V3 COMMAND MENU*`,
      }, { quoted: m });
    }

    if (body === '.ping') {
      const start = Date.now();
      const end = Date.now() - start;
      await conn.sendMessage(sender, { text: `🏓 Pong: ${end}ms` }, { quoted: m });
    }

    if (body === '.help') {
      await conn.sendMessage(sender, { text: `*Available Commands:*\n.alive\n.menu\n.ping\n.help` }, { quoted: m });
    }

    // Load all plugins
    loadPlugins(conn, m, body, sender, fromMe);
  });

  conn.ev.on('creds.update', saveCreds);
}

startBoomMdV3();
