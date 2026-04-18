// UI Elements
const entryScreen = document.getElementById('entry-screen');
const chatScreen = document.getElementById('chat-screen');
const tabBtns = document.querySelectorAll('.tab-btn');
const formContainers = document.querySelectorAll('.form-container');
const statusMsg = document.getElementById('entry-status');

// Inputs
const joinNameInput = document.getElementById('username-join');
const createNameInput = document.getElementById('username-create');
const maxMembersInput = document.getElementById('max-members-create');
const roomCodeInput = document.getElementById('room-code-input');
const messageInput = document.getElementById('message-input');

// Buttons
const btnJoin = document.getElementById('btn-join');
const btnCreate = document.getElementById('btn-create');
const btnSend = document.getElementById('btn-send');
const btnLeave = document.getElementById('btn-leave');
const copyCodeBtn = document.getElementById('copy-code-btn');

// Chat UI Elements
const displayRoomCode = document.getElementById('display-room-code');
const myNameDisplay = document.getElementById('my-name');
const membersList = document.getElementById('members-list');
const memberCount = document.getElementById('member-count');
const messagesContainer = document.getElementById('messages-container');
const myRoleBadge = document.getElementById('my-role-badge');
const chatHeaderTitle = document.getElementById('chat-header-title');

// State
let peer = null;
let currentConnection = null; // For client
let hostConnections = []; // For host
let isHost = false;
let myName = '';
let myId = '';
let roomCode = '';
let maxRoomMembers = 10;
let members = []; // Array of { id, name, isHost }

// Tab Switching logic
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    formContainers.forEach(f => f.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
    statusMsg.textContent = '';
  });
});

// Utilities
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function showStatus(msg, isError = false) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${isError ? 'error' : 'success'}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendMessage(senderName, text, isMe = false, isSystem = false) {
  if (isSystem) {
    const sysDiv = document.createElement('div');
    sysDiv.className = 'system-msg';
    sysDiv.innerHTML = `<div class="sys-content"><i class="fa-solid fa-info-circle"></i> ${text}</div>`;
    messagesContainer.appendChild(sysDiv);
  } else {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message-wrapper ${isMe ? 'sent' : 'received'}`;
    
    const senderSpan = `<span class="msg-sender">${senderName}</span>`;
    const timeSpan = `<span class="msg-time">${formatTime(new Date())}</span>`;
    
    msgDiv.innerHTML = `
      ${isMe ? '' : senderSpan}
      <div class="message">
        ${text}
        ${timeSpan}
      </div>
    `;
    messagesContainer.appendChild(msgDiv);
  }
  scrollToBottom();
}

function updateMembersUI() {
  memberCount.textContent = `${members.length}/${maxRoomMembers}`;
  membersList.innerHTML = '';
  
  members.forEach((m, index) => {
    const li = document.createElement('li');
    li.className = 'member-item';
    
    // Assign a random avatar color based on index
    const avatarClass = `avatar-random-${(index % 4) + 1}`;
    
    li.innerHTML = `
      <div class="avatar ${m.id === myId ? 'gradient-avatar' : avatarClass}">${m.name.charAt(0).toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">
          ${m.name} ${m.id === myId ? '(You)' : ''}
          ${m.isHost ? '<i class="fa-solid fa-crown host-crown" title="Host"></i>' : ''}
        </div>
      </div>
    `;
    membersList.appendChild(li);
  });
}

function broadcastToAll(data) {
  if (!isHost) return;
  hostConnections.forEach(conn => {
    if (conn.open) {
      conn.send(data);
    }
  });
}

function handleIncomingData(data) {
  if (data.type === 'chat') {
    appendMessage(data.senderName, data.text, data.senderId === myId);
    if (isHost && data.senderId !== myId) {
      // Host re-broadcasts to other clients
      broadcastToAll(data);
    }
  } else if (data.type === 'members_update') {
    if (!chatScreen.classList.contains('active') && !isHost) {
      enterChatScreen();
    }
    members = data.members;
    maxRoomMembers = data.maxMembers || 10;
    updateMembersUI();
  } else if (data.type === 'join_error') {
    showStatus(data.reason, true);
    if (peer) peer.destroy();
    setTimeout(() => location.reload(), 2000);
  }
}

// Create Room (Host)
btnCreate.addEventListener('click', () => {
  myName = createNameInput.value.trim() || 'Anonymous';
  maxRoomMembers = parseInt(maxMembersInput.value, 10) || 10;
  if (maxRoomMembers > 10) maxRoomMembers = 10;
  if (maxRoomMembers < 2) maxRoomMembers = 2;
  
  roomCode = generateRoomCode();
  
  showStatus('Generating room...', false);
  
  // Use roomCode as Peer ID
  peer = new Peer(roomCode);
  
  peer.on('open', (id) => {
    isHost = true;
    myId = id;
    myRoleBadge.style.display = 'block';
    chatHeaderTitle.textContent = 'BER OF CHAT (Host)';
    
    // Add self to members
    members.push({ id: myId, name: myName, isHost: true });
    
    enterChatScreen();
  });
  
  peer.on('connection', (conn) => {
    hostConnections.push(conn);
    
    conn.on('open', () => {
      // A new client connected
      // We expect the client to send their info first
    });
    
    conn.on('data', (data) => {
      if (data.type === 'join') {
        if (members.length >= maxRoomMembers) {
          conn.send({ type: 'join_error', reason: 'Room is full (Max ' + maxRoomMembers + ')' });
          setTimeout(() => conn.close(), 500);
          return;
        }
        members.push({ id: data.senderId, name: data.senderName, isHost: false });
        appendMessage('System', `${data.senderName} joined the room.`, false, true);
        
        // Broadcast new member list
        broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
      } else {
        handleIncomingData(data);
      }
    });
    
    conn.on('close', () => {
      // Find and remove member
      const index = members.findIndex(m => m.id === conn.peer);
      if (index !== -1) {
        const leftName = members[index].name;
        members.splice(index, 1);
        appendMessage('System', `${leftName} left the room.`, false, true);
        broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
      }
      hostConnections = hostConnections.filter(c => c.peer !== conn.peer);
    });
  });
  
  peer.on('error', (err) => {
    showStatus('Failed to create room. ID might be taken.', true);
    console.error(err);
  });
});

// Join Room (Client)
btnJoin.addEventListener('click', () => {
  myName = joinNameInput.value.trim() || 'Anonymous';
  const targetCode = roomCodeInput.value.trim().toUpperCase();
  
  if (!targetCode) {
    showStatus('Please enter a room code.', true);
    return;
  }
  
  showStatus('Connecting...', false);
  
  peer = new Peer();
  
  peer.on('open', (id) => {
    isHost = false;
    myId = id;
    roomCode = targetCode;
    
    const conn = peer.connect(targetCode);
    
    conn.on('open', () => {
      currentConnection = conn;
      
      // Send join event to host
      conn.send({ type: 'join', senderId: myId, senderName: myName });
      // We wait for 'members_update' to enter the chat screen
    });
    
    conn.on('data', handleIncomingData);
    
    conn.on('close', () => {
      appendMessage('System', 'Host disconnected. Room closed.', false, true);
      setTimeout(() => location.reload(), 3000);
    });
    
    peer.on('error', (err) => {
      showStatus('Failed to connect. Room code might be invalid.', true);
      console.error(err);
    });
  });
  
  peer.on('error', (err) => {
    showStatus('Peer network error.', true);
    console.error(err);
  });
});

// Transition to Chat
function enterChatScreen() {
  entryScreen.classList.remove('active');
  chatScreen.classList.add('active');
  
  displayRoomCode.textContent = roomCode;
  myNameDisplay.textContent = myName;
  updateMembersUI();
}

// Copy Code
copyCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode);
  copyCodeBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
  copyCodeBtn.style.color = 'var(--success-color)';
  setTimeout(() => {
    copyCodeBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyCodeBtn.style.color = 'var(--text-muted)';
  }, 2000);
});

// Send Message
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  
  const msgData = {
    type: 'chat',
    senderId: myId,
    senderName: myName,
    text: text
  };
  
  if (isHost) {
    // Render locally and broadcast
    appendMessage(myName, text, true);
    broadcastToAll(msgData);
  } else {
    // Send to host
    if (currentConnection && currentConnection.open) {
      appendMessage(myName, text, true);
      currentConnection.send(msgData);
    }
  }
  
  messageInput.value = '';
  messageInput.focus();
}

btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Leave Room
btnLeave.addEventListener('click', () => {
  if (peer) {
    peer.destroy();
  }
  location.reload();
});
