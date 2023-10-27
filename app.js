const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose');
const Game = require('./models/game'); // Adjust the path accordingly
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const uuid = require('uuid');
var bodyParser = require('body-parser')

// parse application/json
app.use(bodyParser.json())

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS, PATCH"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});


const io = new Server(server, {
  cors: {
    // origin: "http://164.92.157.121:80",
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// mongo db connect
const uri =
  'mongodb+srv://netzyn:netzyn@cluster0.xdkmmbg.mongodb.net/' +
  'poker?retryWrites=true&w=majority';
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

db.once('open', () => {
  console.log('Connected to MongoDB');
});

// parse requests of content-type - application/json
app.use(express.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  res.send({ 'body': 'servre is up and running!!!' });
});

app.post('/inithost', async (req, res) => {

  // Create a new Game instance with the received data
  const game = new Game(
    {
      level: req.body.level,
      hostName: req.body.hostName,
      hostID: req.body.hostID,
      activePlayerId:0,
      players: [
      ]
    }
  );

  try {
    // Save the game to MongoDB
    const savedGame = await Game.updateOne({ _id: game.hostID }, { $set: game }, { upsert: true });
    console.log({ code: 200, 'body': JSON.stringify(savedGame) });
    res.send({ code: 200, 'body': JSON.stringify(savedGame) });
  } catch (error) {
    console.error('Error saving game event:', error.message);
    res.send({ code: 500, 'body': {} });
  }

});

app.get('/startgame', async (req, res) => {
  try {
    const hostId = req.query.hostId;

    // Use $set to update only the 'status' field to 'started'
    const result = await Game.updateOne({ _id: hostId }, { $set: { status: 'ongoing' } });

    if (result.nModified === 0) {
      // If nModified is 0, it means the document with the given hostID was not found
      return res.status(404).json({ code: 404, message: 'Game not found for the given hostID' });
    }

    // Return a success response
    res.status(200).json({ code: 200, message: 'Game started successfully' });
  } catch (error) {
    console.error('Error starting the game:', error.message);
    res.status(500).json({ code: 500, message: 'Internal Server Error' });
  }
});

app.get('/initplayer', async (req, res) => {

  const hostId = req.query.hostId;

  try {
    // Step 1: Find the game with the specified hostId
    const game = await Game.findOne({ _id: hostId });

    if (!game) {
      // If the game with the specified hostId is not found, handle accordingly
      return res.status(404).json({ code: 404, message: 'Game not found for the given hostId' });
    }

    if (game.status != "pending") {
      return res.status(500).json({ code: 500, message: 'Game is already started, please wait for next game' });
    }

    if (game.players.length >= 4) {
      return res.status(500).json({ code: 500, message: 'Players limit exceeded' });
    }

    // Step 2: Add a new player to the found game
    const newPlayer = {
      index: game.players.length,
      userID: uuid.v4(), // You can generate a unique user ID here
      bet: 10,
      lastAction: ""
    };

    game.players.push(newPlayer); // Add the new player to the players array

    // Step 3: Save the updated game to the database
    await game.save();
    if((game.players.length) > 1) {
      // if(game.activePlayerId)
      game.players[game.activePlayerId].active = true;
      game.status = "ongoing";
      const result = await Game.updateOne({ _id: hostId }, { $set: game });
    }

    // Step 4: Return the ID of the created player to the user
    res.status(200).json({ code: 200, playerId: newPlayer.userID });
  } catch (error) {
    console.error('Error creating player:', error.message);
    res.status(500).json({ code: 500, message: 'Internal Server Error' });
  }

});

app.get('/updateplayeraction', async (req, res) => {

  const hostId = req.query.hostId;

  try {
    const game = await Game.findOne({ _id: req.query.hostId });

    let player = game.players.filter(p => p.userID == req.query.userId)[0];
    
    if(req.query.action == "Fold") {
      player.isPlaying = false;
      player.lastAction = "Fold";
    } else if(req.query.action == "Raise") {
      player.lastAction = "Raise";
    } else if(req.query.action == "Check") {
      player.lastAction = "Check";
    }
    player.active = false;
    let i=0; 
    do{
      if(game.activePlayerId == ( game.players.length-1)){
        game.level = game.level + 1;
        for(let player in game.players){
          player.lastAction = ""
        }
      }
      if(game.level == 4 || (i == game.players.length)) {
        game.status = "completed";
        game.save();
        return res.status(200).json({ code: 200, message: 'Game is completed'});
      } 
      game.activePlayerId = (game.activePlayerId + 1)%game.players.length;
      i++;
    } while(!game.players[game.activePlayerId].isPlaying);

    game.players[player.index] = player;
    game.players[game.activePlayerId].active = true;

    await game.save();
    res.status(200).json({ code: 200, message: 'updated player information'});
  } catch(error){
    console.error('Error while updating player action:', error.message);
    res.status(500).json({ code: 500, message: 'Error while updating player action' });
  }

});

app.post('/updateplayer', async (req, res) => {
  try {
    const result = await Game.updateOne(
      { _id: req.body.hostId, 'players.userID': req.body.playerId },
      { $set: { 'players.$': req.body.playerInfo } }
    );

    if (result.nModified === 0) {
      return res.status(404).json({ code: 404, message: 'Player not found or no changes were made.' });
    } else {
      return res.status(200).json({ code: 200, message: 'Player information updated successfully.' });
    }
  } catch (error) {
    console.error('Error updating player information:', error.message);
    return res.status(500).json({ code: 500, message: 'Error updating player information' });
  }
});

// socket
const SOCKET_PORT = process.env.SOCKET_PORT || 8085;

io.on('connection', (socket) => {
  console.log('A user connected');

  // Set up a repeating interval to emit game events to connected clients
  const hiInterval = setInterval(async () => {
    try {

      // change the host id here based on the qrcode reponse
      let hostID = "host123";

      // Find the game with the specified hostID
      const gameData = await Game.findOne({ _id: hostID });

      if (gameData) {
        // Emit the game data to the client
        socket.emit('game_update', gameData);
      } else {
        console.log('No game data found for the specified hostID');
      }
    } catch (error) {
      console.error('Error emitting game event:', error.message);
      socket.emit('error', { message: 'Error emitting game event', error: error.message });
    }
  }, 2000);

  // Handle client disconnection
  socket.on('disconnect', () => {
    clearInterval(hiInterval); // Clear the interval when the user disconnects
    console.log('User disconnected');
  });
});

server.listen(SOCKET_PORT, () => {
  console.log(`Socket is running on port ${SOCKET_PORT}.`);
});

// set port, listen for requests
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Http Server is running on port ${PORT}.`);
});
