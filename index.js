const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const pino = require("pino");
const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

async function startNexaSession(socket, phone = null) {
    const { state, saveCreds } = await useMultiFileAuthState('sessions/' + socket.id);
    
    const conn = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["NEXA-MD", "Chrome", "1.0.0"],
    });

    conn.ev.on("creds.update", saveCreds);

    conn.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;

        if (qr) {
            try {
                const qrBase64 = await QRCode.toDataURL(qr);
                socket.emit("qr", qrBase64);
            } catch (err) {
                socket.emit("error", "QR Code generate ചെയ്യാൻ പറ്റിയില്ല");
            }
        }

        if (connection === "open") {
            await delay(5000);
            
            // Full Session ID generation
            const sessionData = Buffer.from(JSON.stringify(conn.authState.creds)).toString('base64');
            const sessionID = "NEXA-MD~" + sessionData;

            // Sending message to the same WhatsApp number
            await conn.sendMessage(conn.user.id, { 
                text: `*NEXA-MD SESSION CONNECTED*\n\n_Keep this session ID safe!_\n\n\`\`\`${sessionID}\`\`\`` 
            });

            socket.emit("session", "Session generated and sent to your WhatsApp!");
            
            // Closing connection after work is done
            await delay(3000);
            conn.logout();
        }

        if (connection === "close") {
            console.log("Connection closed.");
        }
    });

    if (phone && !conn.authState.creds.registered) {
        let phoneNumber = phone.replace(/[^0-9]/g, '');
        await delay(2000);
        try {
            const code = await conn.requestPairingCode(phoneNumber);
            socket.emit("code", code);
        } catch (err) {
            socket.emit("error", "Pairing code request failed. Try again.");
        }
    }
}

io.on("connection", (socket) => {
    socket.on("pair-qr", () => startNexaSession(socket));
    socket.on("pair-code", (phone) => startNexaSession(socket, phone));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
