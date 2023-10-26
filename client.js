const io = require('socket.io-client');
const socket = io('http://localhost:8085');

// Emit an event to the server


// Listen for events from the server
socket.on('game_event', (data) => {
  console.log('Received game event from server:', data);
});
