const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// rooms[code] = [{ socketId, name }]
const rooms = {};

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentName = null;

  socket.on('join', ({ code, name }) => {
    if (!code || !name) return;

    const roomCode = code.trim().toUpperCase();
    const userName = name.trim();

    if (!rooms[roomCode]) {
      rooms[roomCode] = [];
    }

    const room = rooms[roomCode];

    // Already 2 people in room
    if (room.length >= 2) {
      socket.emit('room-full');
      return;
    }

    room.push({ socketId: socket.id, name: userName });
    socket.join(roomCode);
    currentRoom = roomCode;
    currentName = userName;

    if (room.length === 2) {
      // Send each user their partner's name
      room.forEach((user) => {
        const partner = room.find((u) => u.socketId !== user.socketId);
        io.to(user.socketId).emit('matched', {
          partnerName: partner.name,
        });
      });
    } else {
      socket.emit('waiting');
    }
  });

  socket.on('message', ({ text }) => {
    if (!currentRoom || !currentName || !text) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    io.to(currentRoom).emit('message', {
      from: currentName,
      text: text.trim(),
      timestamp,
      socketId: socket.id,
    });
  });

  socket.on('typing', () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('typing', { name: currentName });
  });

  socket.on('stop-typing', () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('stop-typing');
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      socket.to(currentRoom).emit('partner-left');
      rooms[currentRoom] = rooms[currentRoom].filter(
        (u) => u.socketId !== socket.id
      );
      if (rooms[currentRoom].length === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`💝 Lovers Chat running on http://localhost:${PORT}`);
});
