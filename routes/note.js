const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    note: String,
    createdAt: { type: Date, default: Date.now },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user' // Assuming your user model is named 'User'
    }
});

const Note = mongoose.model('note', noteSchema);

module.exports = Note;
