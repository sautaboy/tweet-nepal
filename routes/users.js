const mongoose = require("mongoose");
const plm = require("passport-local-mongoose");
require('dotenv').config();



mongoose.connect("mongodb://localhost/tweet")

const userSchema = new mongoose.Schema({
    name: String,
    username: String,
    password: String,
    userPhoto: String,
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "comment"
    }],
    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "post"
    }],
    notes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "note"
    }],
    gallery: [{ // Add gallery field as an array
        type: String // Assuming each element is a URL to the photo
    }]
});

userSchema.plugin(plm);

// Middleware to automatically add the user's photo to the gallery when a new photo is added
userSchema.pre('save', function (next) {
    if (this.userPhoto && !this.gallery.includes(this.userPhoto)) {
        this.gallery.push(this.userPhoto);
    }
    next();
});

module.exports = mongoose.model("user", userSchema);
