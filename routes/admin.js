const mongoose = require("mongoose");
const plm = require("passport-local-mongoose");
require('dotenv').config();



mongoose.connect("mongodb://localhost/tweet")

const adminSchema = new mongoose.Schema({
    name: String,
    username: String,
    password: String,
});

adminSchema.plugin(plm);

module.exports = mongoose.model("admin", adminSchema);
