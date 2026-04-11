const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const Message = require("./models/Message");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

mongoose.connect("mongodb://127.0.0.1:27017/chatapp");

let users = {};
let rateLimit = {};

function getUsersInRoom(room) {
  return Object.values(users)
    .filter(u => u.room === room)
    .map(u => u.username);
}

io.on("connection", (socket) => {

  socket.on("join", async ({ username, room }) => {
    users[socket.id] = { username, room };
    socket.join(room);

    socket.to(room).emit("system", `${username} joined`);

    io.to(room).emit("userList", getUsersInRoom(room));

    const messages = await Message.find({ room }).sort({ timestamp: -1 }).limit(50);
    socket.emit("loadMessages", messages.reverse());
  });

  socket.on("sendMessage", async (payload) => {
    const user = users[socket.id];
    if (!user) return;

    if (rateLimit[socket.id] && Date.now() - rateLimit[socket.id] < 1000) return;
    rateLimit[socket.id] = Date.now();

    const msgData = {
      room: user.room,
      username: user.username,
      message: payload,
      private: false
    };

    await Message.create(msgData);
    io.to(user.room).emit("message", msgData);
  });

  socket.on("privateMessage", async ({ toUsername, payload }) => {
    const fromUser = users[socket.id];

    const targetSocket = Object.keys(users).find(
      id => users[id].username === toUsername
    );

    if (!targetSocket) return;

    const msgData = {
      room: fromUser.room,
      username: fromUser.username,
      message: payload,
      private: true,
      to: toUsername
    };

    await Message.create(msgData);

    io.to(targetSocket).emit("privateMessage", msgData);
    socket.emit("privateMessage", msgData);
  });

  socket.on("typing", () => {
    const user = users[socket.id];
    socket.to(user.room).emit("typing", user.username);
  });

  socket.on("stopTyping", () => {
    const user = users[socket.id];
    socket.to(user.room).emit("stopTyping");
  });

  socket.on("file", async (file) => {
    const user = users[socket.id];

    const msgData = {
      room: user.room,
      username: user.username,
      file
    };

    await Message.create(msgData);

    io.to(user.room).emit("file", msgData);
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.room).emit("system", `${user.username} left`);
      delete users[socket.id];
      io.to(user.room).emit("userList", getUsersInRoom(user.room));
    }
  });
});

server.listen(3000, () => console.log("Server running on port 3000"));
