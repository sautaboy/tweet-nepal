const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema({
    textComment: String,
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "post"
    },
    date: {
        type: Date,
        default: Date.now()
    }
},
    { timestamps: true }
);

module.exports = mongoose.model("comment", commentSchema);
