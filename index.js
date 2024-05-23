import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import cleanHtml from "sanitize-html"
import he from 'he'
import serverRouter from "./server.js"
import { config } from "dotenv"
import bodyParser from "body-parser"
import session from "express-session"
import fs from "fs"
config()
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

function clearHtml(i){
  const resultHe = he.encode(i)
  return resultHe
}

function generateRandomString(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[{]}|;:,<.>/?';
  let randomString = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    randomString += charset[randomIndex];
  }

  return randomString;
}
if (!fs.existsSync("./salt.txt")) {
  // Menghasilkan string acak dengan panjang 512 karakter
  const salt = Buffer.from(generateRandomString(512)).toString("base64")

  // Menyimpan string acak ke dalam file salt.txt
  fs.writeFileSync("./salt.txt", salt, 'utf8');
  console.log('salt.txt created with a random string.');
} else {
  console.log('salt.txt already exists.');
}
const __dirname = dirname(fileURLToPath(import.meta.url));
app.set("views", join(__dirname, "src"))
app.set("view engine", "ejs")
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: Buffer.from(process.env.SESSION_SECRET).toString("hex"), // Kunci rahasia untuk menandatangani ID sesi
  resave: false, // Jangan menyimpan sesi yang tidak dimodifikasi
  saveUninitialized: true, // Simpan sesi yang baru, bahkan jika tidak ada modifikasi
}));
app.use(express.static(join(__dirname, 'public')));
app.use("/", serverRouter)
app.use((req, res, next) => {
  req.session.logge
  res.status(404).render("404")
})

const db = {}
function getUser(socketId) {
  for (const userId in db) {
    if (db[userId].socketid == socketId) {
      return userId;
    }
  }
  return null;
}

// Socket.io event handling
io.on('connection', (socket) => {
  socket.on("login", (user) => {
    if(user){
      const { userId, username, roomId } = user
      console.log(`${username} logged`)
      db[userId] = {
        socketid: socket.id,
        username: username,
        roomId: roomId
      }
      socket.join(roomId)
    } else {
      console.log("Not logged")
    }
  })
  // Listen for chat message
  socket.on('chat message', (msg) => {
    const userId = getUser(socket.id)
    const username = db[userId]?.username
    console.log("Message", username, "reacted")
    // Broadcast message to all clients
    io.to(db[userId]?.roomId).emit('chat message', { message: clearHtml(msg), user: clearHtml(username), id: clearHtml(userId) });
  });

  // Listen for disconnect
  socket.on('disconnect', () => {
    const userId = getUser[socket.io]
    console.log(db[userId]?.username, "leave")
    delete db[userId]
    socket.leave(db[userId]?.roomId)
  });
});

// Start server
server.listen(process.env.PORT || 3000, () => {
  console.log('listening on *:3000');
});
