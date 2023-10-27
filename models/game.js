const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    index:{ type: Number, required: true },
    userID: { type: String, required: true },
    active: { type: Boolean, default: false },
    isPlaying: { type: Boolean, default: true },
    bet: { type: Number, default: 0 },
    lastAction: { type: String, default: ""}
});

const gameSchema = new mongoose.Schema({
    level: { type: Number, required: true },
    activePlayerId : { type: Number, required: true },
    hostName: { type: String, required: true, index: { unique: true } }, // Enforce uniqueness
    status: { type: String, enum: ['pending', 'ongoing', 'completed'], default: 'pending' },
    players: { type: [playerSchema], default: [] },
    _id: { type: String, alias: 'hostID', required: true }, // Using hostName as _id
});

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
