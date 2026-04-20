const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// socket connection
io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("pair", (phone) => {
    console.log("Phone:", phone);

    // 🔑 fake pairing code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    socket.emit("pair", code);

    socket.emit("msg", "Enter code in WhatsApp");

    // ⏳ simulate session after 10 sec
    setTimeout(() => {
      const session = "NEXA~" + Math.random().toString(36).substring(2, 12);
      socket.emit("session", session);
    }, 10000);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
