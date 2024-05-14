import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public/index.html'));
});

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
    io.to(db[userId]?.roomId).emit('chat message', { message: msg, user: username, id: userId });
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
server.listen(3000, () => {
  console.log('listening on *:3000');
});
