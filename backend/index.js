const express = require("express");
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");
const crypto = require("crypto");
const P = require("pino");
const fs = require("fs");

const app = express();

function generateSessionId() {
  return "NEXA~" + crypto.randomBytes(4).toString("hex");
}

// 🔹 QR SESSION
app.get("/session", async (req, res) => {
  const sessionId = generateSessionId();

  const path = `./sessions/${sessionId}`;
  const { state, saveCreds } = await useMultiFileAuthState(path);

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  });

  sock.ev.on("connection.update", async (update) => {

    if (update.qr) {
      const qr = await QRCode.toDataURL(update.qr);

      return res.json({
        status: "qr",
        sessionId,
        qr
      });
    }

    if (update.connection === "open") {
      console.log("Connected:", sessionId);

      const myNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

      await sock.sendMessage(myNumber, {
        text: `✅ NEXA-MD Connected\n\nSession ID:\n${sessionId}`
      });
    }
  });

  sock.ev.on("creds.update", saveCreds);
});


// 🔹 PAIRING CODE
app.get("/pair", async (req, res) => {
  const number = req.query.number;

  if (!number) return res.json({ error: "Enter number" });

  const sessionId = generateSessionId();

  const path = `./sessions/${sessionId}`;
  const { state, saveCreds } = await useMultiFileAuthState(path);

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  });

  const code = await sock.requestPairingCode(number);

  res.json({
    status: "pair",
    sessionId,
    code
  });

  sock.ev.on("connection.update", async (update) => {
    if (update.connection === "open") {
      const myNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

      await sock.sendMessage(myNumber, {
        text: `✅ NEXA-MD Connected\n\nSession ID:\n${sessionId}`
      });
    }
  });

  sock.ev.on("creds.update", saveCreds);
});

app.listen(3000, () => console.log("Server running"));
