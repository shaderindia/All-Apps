// UI Elements
const entryScreen = document.getElementById('entry-screen');
const chatScreen = document.getElementById('chat-screen');
const tabBtns = document.querySelectorAll('.tab-btn');
const formContainers = document.querySelectorAll('.form-container');
const statusMsg = document.getElementById('entry-status');

// Inputs
const maxMembersInput = document.getElementById('max-members-create');
const roomCodeInput = document.getElementById('room-code-input');
const messageInput = document.getElementById('message-input');
const dobInput = document.getElementById('dob-input');
const maskIpCheckbox = document.getElementById('mask-ip-checkbox');
const tosCheckbox = document.getElementById('tos-checkbox');
const btnDownloadLogs = document.getElementById('btn-download-logs');

// Buttons
const btnJoin = document.getElementById('btn-join');
const btnCreate = document.getElementById('btn-create');
const btnSend = document.getElementById('btn-send');
const btnLeave = document.getElementById('btn-leave');
const copyCodeBtn = document.getElementById('copy-code-btn');
const sidebar = document.querySelector('.sidebar');
const btnMenu = document.getElementById('btn-menu');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const btnLogout = document.getElementById('btn-logout');
const userNameDisplay = document.getElementById('user-name-display');
const userProfileUI = document.getElementById('user-profile');

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
let members = []; // Array of { id, name, isHost, inCall }
let localStream = null;
let calls = {};
let inCall = false;
let isVideo = false;
let callingRestricted = false;
let userCountry = null;
let gdprConsented = null; // Bug #1 fix: declare before GDPR handlers use it

const btnVoiceCall = document.getElementById('btn-voice-call');
const btnVideoCall = document.getElementById('btn-video-call');
const btnEndCall = document.getElementById('btn-end-call');
const btnMuteMic = document.getElementById('btn-mute-mic');
const btnMuteCam = document.getElementById('btn-mute-cam');
const videoGrid = document.getElementById('video-grid');
let isMicMuted = false;
let isCamOff = false;

// XSS Protection
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Geo-Fencing & Region Detection
const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','CH','GB'];
const CCPA_STATES = true; // Show CCPA notice for all US users

async function checkGeoRestrictions() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    userCountry = data.country_code;
    
    // UAE / China VoIP Block
    if (data.country_code === 'AE' || data.country_code === 'CN') {
      callingRestricted = true;
      if (btnVoiceCall) { btnVoiceCall.style.opacity = '0.3'; btnVoiceCall.style.cursor = 'not-allowed'; btnVoiceCall.title = 'VoIP disabled in your region'; }
      if (btnVideoCall) { btnVideoCall.style.opacity = '0.3'; btnVideoCall.style.cursor = 'not-allowed'; btnVideoCall.title = 'VoIP disabled in your region'; }
    }
    
    // GDPR banner for EU users
    if (EU_COUNTRIES.includes(data.country_code) && !localStorage.getItem('ber_gdpr_consent')) {
      const gdprBanner = document.getElementById('gdpr-banner');
      if (gdprBanner) gdprBanner.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Geo-fencing check failed.');
  }
}
checkGeoRestrictions();

// Initialize Supabase
if (typeof initSupabase === 'function') {
  initSupabase();
}

// ============================================================
// Auth Session Check
// ============================================================
let loggedInUser = JSON.parse(localStorage.getItem('ber_user') || 'null');

function checkAuth() {
  if (!loggedInUser) {
    console.log('[Auth] Login system disabled. Allowing direct access.');
    // Set global myName to a default or wait for them to input it
    myName = 'Guest-' + Math.floor(Math.random() * 10000);
    return true; // Used to redirect to login.html
  }
  
  // Update UI with user info
  if (userProfileUI) userProfileUI.classList.remove('hidden');
  if (userNameDisplay) userNameDisplay.textContent = loggedInUser.display_name;
  
  // Set global myName for chat
  myName = loggedInUser.display_name;
  return true;
}

if (checkAuth()) {
  // Continue with other initializations if needed
}

if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('ber_user');
    window.location.reload(); // Used to redirect to login.html
  });
}

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

// ============================================================
// GDPR / CCPA / Global Privacy Compliance
// ============================================================
const gdprBanner = document.getElementById('gdpr-banner');
const gdprAccept = document.getElementById('gdpr-accept');
const gdprReject = document.getElementById('gdpr-reject');
const btnDeleteData = document.getElementById('btn-delete-data');

if (gdprAccept) {
  gdprAccept.addEventListener('click', () => {
    localStorage.setItem('ber_gdpr_consent', JSON.stringify({
      status: 'accepted',
      timestamp: new Date().toISOString(),
      scope: ['localStorage', 'traceability_hashes', 'consent_records'],
      version: '1.0'
    }));
    gdprConsented = 'accepted';
    if (gdprBanner) gdprBanner.classList.add('hidden');
  });
}

if (gdprReject) {
  gdprReject.addEventListener('click', () => {
    localStorage.setItem('ber_gdpr_consent', JSON.stringify({
      status: 'rejected',
      timestamp: new Date().toISOString(),
      version: '1.0'
    }));
    gdprConsented = 'rejected';
    if (gdprBanner) gdprBanner.classList.add('hidden');
    window._gdprRejected = true;
  });
}

// Delete My Data (GDPR Right to Erasure + Right to Withdraw)
if (btnDeleteData) {
  btnDeleteData.addEventListener('click', async () => {
    const confirmed = confirm(
      'GDPR Data Deletion Request\n\n' +
      'This will PERMANENTLY:\n' +
      '• Delete your account from our server\n' +
      '• Clear all local consent records\n' +
      '• Revoke your Terms of Service agreement\n\n' +
      'Continue?'
    );
    
    if (confirmed) {
      if (loggedInUser && loggedInUser.phone) {
        try {
          const { data, error } = await supabaseClient.rpc('delete_user_account', { 
            p_phone: loggedInUser.phone 
          });
          if (error) console.error('[GDPR] Server deletion failed:', error);
        } catch (err) {
          console.error('[GDPR] Error calling delete RPC:', err);
        }
      }

      localStorage.removeItem('ber_user');
      localStorage.removeItem('ber_tos_agreed');
      localStorage.removeItem('ber_gdpr_consent');
      localStorage.removeItem('berofchat_consent_logs');
      
      alert('Your account and data have been permanently deleted. The page will now reload.');
      location.reload();
    }
  });
}

// Mobile Sidebar Logic
if (btnMenu) {
  btnMenu.addEventListener('click', () => { sidebar.classList.add('open'); });
}
if (btnCloseSidebar) {
  btnCloseSidebar.addEventListener('click', () => { sidebar.classList.remove('open'); });
}
if (membersList) {
  membersList.addEventListener('click', () => {
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
  });
}

// TOS Modal Logic
const tosModal = document.getElementById('tos-modal');
const btnAcceptTos = document.getElementById('btn-accept-tos');

function checkTosAgreement() {
  if (localStorage.getItem('ber_tos_agreed') === 'true') {
    if (tosModal) tosModal.classList.add('hidden');
    if (tosCheckbox) tosCheckbox.checked = true;
  }
}
if (btnAcceptTos) {
  btnAcceptTos.addEventListener('click', () => {
    localStorage.setItem('ber_tos_agreed', 'true');
    if (tosModal) tosModal.classList.add('hidden');
    if (tosCheckbox) tosCheckbox.checked = true;
  });
}
checkTosAgreement();

// Utilities
function getPeerConfig() {
  const maskIp = maskIpCheckbox ? maskIpCheckbox.checked : false;
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };
  if (maskIp) {
    config.iceServers.push({ urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" });
    config.iceServers.push({ urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" });
    config.iceTransportPolicy = 'relay';
  }
  return config;
}

function calculateAge(dobStr) {
  // Bug #10 fix: proper age calculation that handles edge cases correctly
  if (!dobStr) return 0;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age < 0 ? 0 : age;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function logConsent(age) {
  const consentData = { consentId: generateUUID(), timestamp: new Date().toISOString(), ageAtConsent: age, agreedToTOS: true };
  let logs = [];
  try { const saved = localStorage.getItem('berofchat_consent_logs'); if (saved) logs = JSON.parse(saved); } catch (e) {}
  logs.push(consentData);
  localStorage.setItem('berofchat_consent_logs', JSON.stringify(logs));
}

if (btnDownloadLogs) {
  btnDownloadLogs.addEventListener('click', () => {
    const saved = localStorage.getItem('berofchat_consent_logs');
    if (!saved) { alert('No consent logs found.'); return; }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(saved);
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "berofchat_consent_audit_logs.json");
    dlAnchorElem.click();
  });
}

// IT Rules 2021: Traceability
async function logMessageTrace(text) {
  if (typeof logMessageHash === 'function') {
    logMessageHash(myId, roomCode, text);
  }
}

// Incoming Call Logic
let pendingCall = null;
const incomingCallModal = document.getElementById('incoming-call-modal');
const callerNameDisplay = document.getElementById('caller-name-display');
const btnAcceptCall = document.getElementById('btn-accept-call');
const btnDeclineCall = document.getElementById('btn-decline-call');

function showIncomingCall(call) {
  pendingCall = call;
  callerNameDisplay.textContent = call.metadata?.senderName || 'Someone';
  incomingCallModal.classList.remove('hidden');
}

if(btnAcceptCall) {
  btnAcceptCall.addEventListener('click', async () => {
    if (pendingCall) {
      const callToAnswer = pendingCall;
      incomingCallModal.classList.add('hidden');
      if (!inCall) await toggleCall(false);
      if (localStream) {
        callToAnswer.answer(localStream);
        handleCall(callToAnswer, callToAnswer.metadata?.senderName || 'Unknown');
      }
    }
  });
}
if(btnDeclineCall) {
  btnDeclineCall.addEventListener('click', () => { if (pendingCall) { pendingCall.close(); incomingCallModal.classList.add('hidden'); } });
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let res = '';
  for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
}

function showStatus(msg, isError = false) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${isError ? 'error' : 'success'}`;
}

function formatTime(date) { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

function appendMessage(senderName, text, isMe = false, isSystem = false) {
  const safeName = escapeHTML(senderName);
  const safeText = escapeHTML(text);
  const msgDiv = document.createElement('div');
  msgDiv.className = isSystem ? 'system-msg' : `message-wrapper ${isMe ? 'sent' : 'received'}`;
  
  if (isSystem) {
    msgDiv.innerHTML = `<div class="sys-content"><i class="fa-solid fa-info-circle"></i> ${safeText}</div>`;
  } else {
    msgDiv.innerHTML = `
      ${isMe ? '' : `<span class="msg-sender">${safeName}</span>`}
      <div class="message">${safeText}<span class="msg-time">${formatTime(new Date())}</span></div>
    `;
  }
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateMembersUI() {
  memberCount.textContent = `${members.length}/${maxRoomMembers}`;
  membersList.innerHTML = '';
  members.forEach((m, i) => {
    const li = document.createElement('li');
    li.className = 'member-item';
    const safeMName = escapeHTML(m.name);
    li.innerHTML = `
      <div class="avatar avatar-random-${(i % 4) + 1}">${safeMName.charAt(0).toUpperCase()}</div>
      <div class="member-info"><div class="member-name">${safeMName} ${m.id === myId ? '(You)' : ''} ${m.isHost ? '<i class="fa-solid fa-crown host-crown"></i>' : ''}</div></div>
    `;
    membersList.appendChild(li);
  });
}

function broadcastToAll(data, excludePeerId = null) {
  if (!isHost) return;
  hostConnections.forEach(conn => { if (conn.open && conn.peer !== excludePeerId) conn.send(data); });
}

function handleIncomingData(data) {
  if (data.type === 'chat') {
    appendMessage(data.senderName, data.text, data.senderId === myId);
    if (isHost && data.senderId !== myId) broadcastToAll(data, data.senderId);
  } else if (data.type === 'members_update') {
    if (!chatScreen.classList.contains('active') && !isHost) enterChatScreen();
    members = data.members;
    maxRoomMembers = data.maxMembers || 10;
    updateMembersUI();
    if (inCall) callOtherInCallMembers();
  } else if (data.type === 'join_error') {
    showStatus(data.reason, true);
    if (peer) peer.destroy();
    setTimeout(() => location.reload(), 2000);
  }
}

async function toggleCall(withVideo = false) {
  if (callingRestricted) { alert("VoIP restricted in your region."); return; }
  if (inCall) { leaveCall(); return; }
  try {
    isVideo = withVideo;
    localStream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
    inCall = true;
    if (btnEndCall) btnEndCall.classList.remove('hidden');
    // Bug #8 fix: show mute buttons when call starts
    if (btnMuteMic) btnMuteMic.classList.remove('hidden');
    if (btnMuteCam) btnMuteCam.classList.remove('hidden');
    videoGrid.classList.remove('hidden');
    addVideoStream(myId, myName, localStream, true);
    if (isHost) {
      // Bug #4 fix: null-guard before accessing .inCall
      const selfMember = members.find(m => m.id === myId);
      if (selfMember) selfMember.inCall = true;
      broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
      callOtherInCallMembers();
    } else {
      // Bug #2 fix: include senderId in call_status payload
      currentConnection?.send({ type: 'call_status', inCall: true, senderId: myId });
      callOtherInCallMembers();
    }
  } catch (err) { showStatus('Media access failed', true); }
}

function leaveCall() {
  inCall = false;
  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;
  videoGrid.classList.add('hidden');
  videoGrid.innerHTML = '';
  Object.values(calls).forEach(c => c.close());
  calls = {};
  // Bug #9 fix: hide mute buttons and reset their state when call ends
  if (btnEndCall) btnEndCall.classList.add('hidden');
  if (btnMuteMic) {
    btnMuteMic.classList.add('hidden');
    btnMuteMic.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    btnMuteMic.style.color = '';
  }
  if (btnMuteCam) {
    btnMuteCam.classList.add('hidden');
    btnMuteCam.innerHTML = '<i class="fa-solid fa-video"></i>';
    btnMuteCam.style.color = '';
  }
  isMicMuted = false;
  isCamOff = false;
  if (isHost) {
    // Bug #3 fix: null-guard before accessing .inCall
    const selfMember = members.find(m => m.id === myId);
    if (selfMember) selfMember.inCall = false;
    broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
  } else {
    // Bug #2 fix: include senderId in call_status payload
    currentConnection?.send({ type: 'call_status', inCall: false, senderId: myId });
  }
}

function callOtherInCallMembers() {
  members.forEach(m => {
    // Only call if ID is strictly greater to prevent duplicate/racing calls in the mesh
    if (m.id !== myId && m.inCall && !calls[m.id] && myId < m.id) {
      const call = peer.call(m.id, localStream, { metadata: { senderName: myName } });
      handleCall(call, m.name);
    }
  });
}

function handleCall(call, name) {
  calls[call.peer] = call;
  call.on('stream', s => addVideoStream(call.peer, name, s, false));
  call.on('close', () => { removeVideoStream(call.peer); delete calls[call.peer]; });
}

function addVideoStream(id, name, stream, isLocal) {
  if (document.getElementById(`video-wrapper-${id}`)) return;
  const w = document.createElement('div');
  w.className = 'video-wrapper';
  w.id = `video-wrapper-${id}`;
  const v = document.createElement('video');
  v.srcObject = stream; v.autoplay = true; v.playsInline = true; if (isLocal) v.muted = true;
  w.innerHTML = `<div class="video-label">${escapeHTML(name)}</div>`;
  w.prepend(v);
  videoGrid.appendChild(w);
}

function removeVideoStream(id) { document.getElementById(`video-wrapper-${id}`)?.remove(); }

// Bug #16 fix: null-guard call control buttons
if (btnVoiceCall) btnVoiceCall.addEventListener('click', () => toggleCall(false));
if (btnVideoCall) btnVideoCall.addEventListener('click', () => toggleCall(true));
if (btnEndCall) btnEndCall.addEventListener('click', leaveCall);

// Mute/Unmute Controls
if (btnMuteMic) {
  btnMuteMic.addEventListener('click', () => {
    if (!localStream) return;
    isMicMuted = !isMicMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
    btnMuteMic.innerHTML = isMicMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
    btnMuteMic.style.color = isMicMuted ? 'var(--danger-color)' : '';
  });
}
if (btnMuteCam) {
  btnMuteCam.addEventListener('click', () => {
    if (!localStream) return;
    isCamOff = !isCamOff;
    localStream.getVideoTracks().forEach(t => { t.enabled = !isCamOff; });
    btnMuteCam.innerHTML = isCamOff ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>';
    btnMuteCam.style.color = isCamOff ? 'var(--danger-color)' : '';
  });
}

// Bug #7 fix: wire up the search button
const btnSearch = document.getElementById('btn-search');
if (btnSearch) {
  btnSearch.addEventListener('click', () => {
    const query = prompt('Search messages:');
    if (!query || !query.trim()) return;
    const q = query.trim().toLowerCase();
    const allMessages = messagesContainer.querySelectorAll('.message');
    let found = false;
    // Remove any previous highlights
    messagesContainer.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
    allMessages.forEach(el => {
      if (el.textContent.toLowerCase().includes(q)) {
        el.classList.add('search-highlight');
        if (!found) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); found = true; }
      }
    });
    if (!found) showStatus('No messages found.', true);
    // Auto-clear highlight after 3s
    setTimeout(() => messagesContainer.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight')), 3000);
  });
}

// Grievance Report Modal
const reportModal = document.getElementById('report-modal');
const btnReport = document.getElementById('btn-report');
const btnCancelReport = document.getElementById('btn-cancel-report');
const btnSubmitReport = document.getElementById('btn-submit-report');
const reportText = document.getElementById('report-text');

if (btnReport) btnReport.addEventListener('click', () => { if (reportModal) reportModal.classList.remove('hidden'); });
if (btnCancelReport) btnCancelReport.addEventListener('click', () => { if (reportModal) reportModal.classList.add('hidden'); if (reportText) reportText.value = ''; });
if (btnSubmitReport) {
  btnSubmitReport.addEventListener('click', () => {
    if (!reportText || !reportText.value.trim()) return;
    const body = encodeURIComponent('Grievance Report (BER OF CHAT):\n\n' + reportText.value);
    window.location.href = `mailto:nxdecore@gmail.com?subject=Grievance Report - BER OF CHAT&body=${body}`;
    if (reportModal) reportModal.classList.add('hidden');
    reportText.value = '';
    alert('Report prepared. Your email client will open to submit the report to the Resident Grievance Officer.');
  });
}

// Create/Join Listeners
btnCreate.addEventListener('click', () => {
  const guestNameInput = document.getElementById('guest-name-input');
  const enteredName = guestNameInput ? guestNameInput.value.trim() : '';
  
  if (!tosCheckbox.checked) { showStatus('Agree to Terms first.', true); return; }
  const age = calculateAge(dobInput.value);
  if (age < 19) { showStatus('Must be 19+.', true); return; }
  logConsent(age);
  
  myName = enteredName || 'Guest-' + Math.floor(Math.random() * 10000);
  maxRoomMembers = parseInt(maxMembersInput.value, 10) || 10;
  if (maxRoomMembers > 10) maxRoomMembers = 10;
  if (maxRoomMembers < 2) maxRoomMembers = 2;
  roomCode = generateRoomCode();
  peer = new Peer(roomCode, getPeerConfig());
  peer.on('open', id => {
    isHost = true; myId = id;
    myRoleBadge.style.display = 'block';
    members.push({ id, name: myName, isHost: true, inCall: false });
    enterChatScreen();
  });
  peer.on('call', call => {
    if (inCall && localStream) { call.answer(localStream); handleCall(call, call.metadata?.senderName || 'Unknown'); }
    else showIncomingCall(call);
  });
  peer.on('connection', conn => {
    hostConnections.push(conn);
    conn.on('data', data => {
      if (data.type === 'join') {
        if (members.length >= maxRoomMembers) {
          conn.send({ type: 'join_error', reason: 'Room is full (Max ' + maxRoomMembers + ')' });
          setTimeout(() => conn.close(), 500);
          return;
        }
        members.push({ id: data.senderId, name: data.senderName, isHost: false, inCall: false });
        appendMessage('System', `${data.senderName} joined the room.`, false, true);
        broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
      } else if (data.type === 'call_status') {
        // Bug #2 fix: senderId is now included in the payload; Bug #11 fix: updateMembersUI
        const member = members.find(m => m.id === data.senderId);
        if (member) member.inCall = data.inCall;
        updateMembersUI();
        broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
      } else handleIncomingData(data);
    });
    conn.on('close', () => {
      const idx = members.findIndex(m => m.id === conn.peer);
      if (idx !== -1) {
        appendMessage('System', `${members[idx].name} left the room.`, false, true);
        members.splice(idx, 1);
        broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
      }
      hostConnections = hostConnections.filter(c => c.peer !== conn.peer);
    });
  });
  peer.on('error', err => { showStatus('Failed to create room.', true); console.error(err); });
});

btnJoin.addEventListener('click', () => {
  const guestNameInput = document.getElementById('guest-name-input');
  const enteredName = guestNameInput ? guestNameInput.value.trim() : '';
  
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) { showStatus('Enter room code.', true); return; }
  if (!tosCheckbox.checked) { showStatus('Agree to Terms first.', true); return; }
  const age = calculateAge(dobInput.value);
  if (age < 19) { showStatus('Must be 19+.', true); return; }
  logConsent(age);
  
  myName = enteredName || 'Guest-' + Math.floor(Math.random() * 10000);
  showStatus('Connecting...', false);
  peer = new Peer(getPeerConfig());
  peer.on('open', id => {
    myId = id; roomCode = code;
    const conn = peer.connect(code);
    conn.on('open', () => { currentConnection = conn; conn.send({ type: 'join', senderId: id, senderName: myName }); });
    conn.on('data', handleIncomingData);
    conn.on('close', () => {
      appendMessage('System', 'Host disconnected. Room closed.', false, true);
      setTimeout(() => location.reload(), 3000);
    });
  });
  peer.on('call', call => {
    if (inCall && localStream) { call.answer(localStream); handleCall(call, call.metadata?.senderName || 'Unknown'); }
    else showIncomingCall(call);
  });
  peer.on('error', err => { showStatus('Failed to connect. Invalid room code?', true); console.error(err); });
});

function enterChatScreen() {
  entryScreen.classList.remove('active');
  chatScreen.classList.add('active');
  displayRoomCode.textContent = roomCode;
  myNameDisplay.textContent = myName;
  updateMembersUI();
  if (typeof logRoomJoin === 'function') logRoomJoin(myId, roomCode);
}

// Bug #17 fix: null-guard copyCodeBtn
if (copyCodeBtn) {
  copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode);
    copyCodeBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => { copyCodeBtn.innerHTML = '<i class="fa-solid fa-copy"></i>'; }, 2000);
  });
}

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  const msg = { type: 'chat', senderId: myId, senderName: myName, text };
  if (isHost) { appendMessage(myName, text, true); broadcastToAll(msg); logMessageTrace(text); }
  else if (currentConnection?.open) { appendMessage(myName, text, true); currentConnection.send(msg); logMessageTrace(text); }
  messageInput.value = '';
}
btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

btnLeave.addEventListener('click', () => {
  leaveCall();
  if (typeof logRoomLeave === 'function') logRoomLeave(myId, roomCode);
  peer?.destroy();
  location.reload();
});
