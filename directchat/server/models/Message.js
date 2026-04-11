const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  room: String,
  username: String,
  message: Object, // encrypted payload
  private: Boolean,
  to: String,
  file: Object,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);
