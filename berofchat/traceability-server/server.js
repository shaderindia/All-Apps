const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'trace_logs.json');

app.use(cors());
app.use(express.json());

// Initialize log file if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([]));
}

app.post('/log-trace', (req, res) => {
  const { senderId, messageHash, timestamp, roomCode } = req.body;
  
  if (!senderId || !messageHash || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const logEntry = {
    senderId,
    messageHash,
    timestamp,
    roomCode: roomCode || 'UNKNOWN',
    serverReceivedAt: new Date().toISOString()
  };

  try {
    const rawData = fs.readFileSync(LOG_FILE);
    const logs = JSON.parse(rawData);
    logs.push(logEntry);
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    
    console.log(`[Traceability] Logged hash ${messageHash} from ${senderId}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to write log', err);
    res.status(500).json({ error: 'Failed to write trace log' });
  }
});

app.get('/', (req, res) => {
  res.send('BER OF CHAT Traceability Server is running. Complying with IT Rules 2021.');
});

app.listen(PORT, () => {
  console.log(`Traceability server running on port ${PORT}`);
});
