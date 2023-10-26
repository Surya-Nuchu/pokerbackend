const io = require('socket.io-client');
const socket = io('http://localhost:3000');

// Emit an event to the server

// socket.emit('game_event', {
//     level: 1,
//     hostName: 'Example Host',
//     hostID: 'host123',
//     players: [
//       {
//         userID: 'player1',
//         active: true,
//         bet: 10,
//         actions: ['move', 'jump']
//       },
//       {
//         userID: 'player2',
//         active: true,
//         bet: 5,
//         actions: ['attack', 'defend']
//       }
//     ]
// });

// Listen for events from the server
socket.on('game_event', (data) => {
  console.log('Received game event from server:', data);
});
