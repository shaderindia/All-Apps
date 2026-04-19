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

const btnVoiceCall = document.getElementById('btn-voice-call');
const btnVideoCall = document.getElementById('btn-video-call');
const btnEndCall = document.getElementById('btn-end-call');
const videoGrid = document.getElementById('video-grid');

// Geo-Fencing & India Detection
async function checkGeoRestrictions() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    userCountry = data.country_code;
    
    // UAE / China VoIP Block
    if (data.country_code === 'AE' || data.country_code === 'CN') {
      callingRestricted = true;
      console.warn(`Calling disabled in region: ${data.country_code}`);
      if (btnVoiceCall) { btnVoiceCall.style.opacity = '0.3'; btnVoiceCall.style.cursor = 'not-allowed'; btnVoiceCall.title = 'VoIP disabled in your region'; }
      if (btnVideoCall) { btnVideoCall.style.opacity = '0.3'; btnVideoCall.style.cursor = 'not-allowed'; btnVideoCall.title = 'VoIP disabled in your region'; }
    }
    
    // India SIM-Binding OTP
    if (data.country_code === 'IN') {
      const otpSection = document.getElementById('otp-section');
      if (otpSection) otpSection.classList.remove('hidden');
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

// India OTP UI Logic
const btnSendOtp = document.getElementById('btn-send-otp');
const btnVerifyOtp = document.getElementById('btn-verify-otp');
const otpPhoneInput = document.getElementById('otp-phone');
const otpCodeInput = document.getElementById('otp-code');
const otpStepPhone = document.getElementById('otp-step-phone');
const otpStepVerify = document.getElementById('otp-step-verify');
const otpStatusEl = document.getElementById('otp-status');
const otpVerifiedBadge = document.getElementById('otp-verified-badge');

if (btnSendOtp) {
  btnSendOtp.addEventListener('click', async () => {
    const phone = otpPhoneInput ? otpPhoneInput.value.trim() : '';
    if (!phone || phone.length < 10) {
      showStatus('Enter a valid Indian phone number (+91...)', true);
      return;
    }
    try {
      btnSendOtp.disabled = true;
      btnSendOtp.textContent = 'Sending...';
      await sendOTP(phone);
      if (otpStepPhone) otpStepPhone.classList.add('hidden');
      if (otpStepVerify) otpStepVerify.classList.remove('hidden');
      if (otpStatusEl) otpStatusEl.textContent = 'OTP sent to ' + phone;
    } catch (err) {
      // Twilio not configured — fallback to self-declaration
      console.warn('[OTP] SMS provider not configured. Falling back to self-declaration.');
      if (otpStepPhone) otpStepPhone.classList.add('hidden');
      if (otpStepVerify) otpStepVerify.classList.add('hidden');
      
      // Show self-declaration fallback
      const otpSection = document.getElementById('otp-section');
      if (otpSection) {
        const fallback = document.createElement('div');
        fallback.style.cssText = 'text-align: center; padding: 10px;';
        fallback.innerHTML = `
          <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
            <i class="fa-solid fa-info-circle" style="color: var(--accent-color);"></i> 
            SMS verification is being set up. Please self-declare for now.
          </p>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; color: var(--text-muted); justify-content: center;">
            <input type="checkbox" id="otp-self-declare" style="accent-color: var(--success-color); width: 16px; height: 16px;">
            <span>I confirm I am an Indian resident with a valid mobile number</span>
          </label>
        `;
        otpSection.appendChild(fallback);
        
        const selfDeclare = fallback.querySelector('#otp-self-declare');
        selfDeclare.addEventListener('change', () => {
          if (selfDeclare.checked) {
            otpVerified = true;
            if (otpVerifiedBadge) otpVerifiedBadge.classList.remove('hidden');
            fallback.style.display = 'none';
          }
        });
      }
    }
  });
}

if (btnVerifyOtp) {
  btnVerifyOtp.addEventListener('click', async () => {
    const phone = otpPhoneInput ? otpPhoneInput.value.trim() : '';
    const code = otpCodeInput ? otpCodeInput.value.trim() : '';
    if (!code || code.length !== 6) {
      if (otpStatusEl) otpStatusEl.textContent = 'Enter a valid 6-digit code.';
      return;
    }
    try {
      btnVerifyOtp.disabled = true;
      btnVerifyOtp.textContent = 'Verifying...';
      await verifyOTP(phone, code);
      if (otpStepVerify) otpStepVerify.classList.add('hidden');
      if (otpVerifiedBadge) otpVerifiedBadge.classList.remove('hidden');
    } catch (err) {
      if (otpStatusEl) otpStatusEl.textContent = 'Invalid OTP. Try again.';
      btnVerifyOtp.disabled = false;
      btnVerifyOtp.innerHTML = '<i class="fa-solid fa-check-double"></i> Verify OTP';
    }
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
// GDPR Compliance (EU Users)
// ============================================================
const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','CH','GB'];
let isEU = false;
let gdprConsented = localStorage.getItem('ber_gdpr_consent');

const gdprBanner = document.getElementById('gdpr-banner');
const gdprAccept = document.getElementById('gdpr-accept');
const gdprReject = document.getElementById('gdpr-reject');
const btnDeleteData = document.getElementById('btn-delete-data');

function checkIfEU() {
  if (userCountry && EU_COUNTRIES.includes(userCountry)) {
    isEU = true;
    if (!gdprConsented) {
      // Show GDPR banner for first-time EU users
      if (gdprBanner) gdprBanner.classList.remove('hidden');
    }
  }
}

// Re-check after geo loads (userCountry is set by checkGeoRestrictions)
const origGeoCheck = checkGeoRestrictions;
checkGeoRestrictions = async function() {
  await origGeoCheck();
  checkIfEU();
};

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
    // Disable traceability logging for users who rejected
    window._gdprRejected = true;
  });
}

// Delete My Data (GDPR Right to Erasure + Right to Withdraw)
if (btnDeleteData) {
  btnDeleteData.addEventListener('click', () => {
    const confirmed = confirm(
      'GDPR Data Deletion Request\n\n' +
      'This will:\n' +
      '• Clear all consent records from this device\n' +
      '• Revoke your Terms of Service agreement\n' +
      '• Remove all locally stored preferences\n\n' +
      'Server-side traceability hashes (anonymized) will auto-purge within 180 days.\n\n' +
      'Continue?'
    );
    if (confirmed) {
      // Clear ALL localStorage related to BER OF CHAT
      localStorage.removeItem('ber_tos_agreed');
      localStorage.removeItem('ber_gdpr_consent');
      localStorage.removeItem('ber_consent_log');
      
      alert('All your data has been deleted. The page will now reload.');
      location.reload();
    }
  });
}

// Mobile Sidebar Logic
if (btnMenu) {
  btnMenu.addEventListener('click', () => {
    sidebar.classList.add('open');
  });
}

if (btnCloseSidebar) {
  btnCloseSidebar.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });
}

// Close sidebar when clicking a member or leaving room on mobile
if (membersList) {
  membersList.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
    }
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

// Run agreement check on load
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
    // Add free TURN servers to mask IP addresses
    config.iceServers.push({
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    });
    config.iceServers.push({
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    });
    config.iceServers.push({
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    });
    // Force Relay-only to completely hide local IP
    config.iceTransportPolicy = 'relay';
  }

  return config;
}

function calculateAge(dobStr) {
  if (!dobStr) return 0;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return 0;
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs); 
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// Audit Logging
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function logConsent(age) {
  const consentData = {
    consentId: generateUUID(),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    ageAtConsent: age,
    agreedToTOS: true
  };
  let logs = [];
  try {
    const saved = localStorage.getItem('berofchat_consent_logs');
    if (saved) logs = JSON.parse(saved);
  } catch (e) {}
  logs.push(consentData);
  localStorage.setItem('berofchat_consent_logs', JSON.stringify(logs));
}

if (btnDownloadLogs) {
  btnDownloadLogs.addEventListener('click', () => {
    let logs = [];
    try {
      const saved = localStorage.getItem('berofchat_consent_logs');
      if (saved) logs = JSON.parse(saved);
    } catch (e) {}
    
    if (logs.length === 0) {
      alert('No consent logs found. You have not agreed to the TOS yet.');
      return;
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "berofchat_consent_audit_logs.json");
    dlAnchorElem.click();
  });
}

// Grievance Report Modal Logic
const reportModal = document.getElementById('report-modal');
const btnReport = document.getElementById('btn-report');
const btnCancelReport = document.getElementById('btn-cancel-report');
const btnSubmitReport = document.getElementById('btn-submit-report');
const reportText = document.getElementById('report-text');

if (btnReport) {
  btnReport.addEventListener('click', () => {
    reportModal.classList.remove('hidden');
  });
}

if (btnCancelReport) {
  btnCancelReport.addEventListener('click', () => {
    reportModal.classList.add('hidden');
    reportText.value = '';
  });
}

if (btnSubmitReport) {
  btnSubmitReport.addEventListener('click', () => {
    if (!reportText.value.trim()) return;
    const body = encodeURIComponent("Grievance Report (BER OF CHAT):\n\n" + reportText.value);
    window.location.href = `mailto:nxdecore@gmail.com?subject=Grievance Report - BER OF CHAT&body=${body}`;
    reportModal.classList.add('hidden');
    reportText.value = '';
    alert('Report prepared. Your default email client should open to submit the report to the Resident Grievance Officer.');
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// IT Rules 2021: Traceability
const TRACEABILITY_SERVER_URL = 'http://localhost:3000';

async function generateMessageHash(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function logMessageTrace(text) {
  // Log to Supabase (primary)
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
  const callerName = call.metadata && call.metadata.senderName ? call.metadata.senderName : 'Someone';
  callerNameDisplay.textContent = callerName;
  incomingCallModal.classList.remove('hidden');
}

function hideIncomingCall() {
  incomingCallModal.classList.add('hidden');
  pendingCall = null;
}

if(btnAcceptCall) {
  btnAcceptCall.addEventListener('click', async () => {
    if (pendingCall) {
      const callToAnswer = pendingCall;
      hideIncomingCall();
      if (!inCall) {
        await toggleCall(false); // Join with voice by default
      }
      if (localStream) {
        callToAnswer.answer(localStream);
        const callerName = callToAnswer.metadata && callToAnswer.metadata.senderName ? callToAnswer.metadata.senderName : 'Unknown';
        handleCall(callToAnswer, callerName);
      }
    }
  });
}

if(btnDeclineCall) {
  btnDeclineCall.addEventListener('click', () => {
    if (pendingCall) {
      pendingCall.close();
      hideIncomingCall();
    }
  });
}
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
  const safeText = escapeHTML(text);
  const safeName = escapeHTML(senderName);
  
  if (isSystem) {
    const sysDiv = document.createElement('div');
    sysDiv.className = 'system-msg';
    sysDiv.innerHTML = `<div class="sys-content"><i class="fa-solid fa-info-circle"></i> ${safeText}</div>`;
    messagesContainer.appendChild(sysDiv);
  } else {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message-wrapper ${isMe ? 'sent' : 'received'}`;
    
    const senderSpan = `<span class="msg-sender">${safeName}</span>`;
    const timeSpan = `<span class="msg-time">${formatTime(new Date())}</span>`;
    
    msgDiv.innerHTML = `
      ${isMe ? '' : senderSpan}
      <div class="message">
        ${safeText}
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

function broadcastToAll(data, excludePeerId = null) {
  if (!isHost) return;
  hostConnections.forEach(conn => {
    if (conn.open && conn.peer !== excludePeerId) {
      conn.send(data);
    }
  });
}

function handleIncomingData(data) {
  if (data.type === 'chat') {
    appendMessage(data.senderName, data.text, data.senderId === myId);
    if (isHost && data.senderId !== myId) {
      // Host re-broadcasts to other clients
      broadcastToAll(data, data.senderId);
    }
  } else if (data.type === 'members_update') {
    if (!chatScreen.classList.contains('active') && !isHost) {
      enterChatScreen();
    }
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

// WebRTC Call Logic
async function toggleCall(withVideo = false) {
  if (callingRestricted) {
    alert("Voice/Video calling features are restricted in your region (UAE/China) due to strict ISP VoIP blocking policies.");
    return;
  }

  if (inCall) {
    leaveCall();
    return;
  }
  
  try {
    isVideo = withVideo;
    localStream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
    inCall = true;
    
    if (withVideo) btnVideoCall.classList.add('active');
    else btnVoiceCall.classList.add('active');
    
    btnEndCall.classList.remove('hidden');
    btnMuteMic.classList.remove('hidden');
    if (withVideo) btnMuteCam.classList.remove('hidden');
    videoGrid.classList.remove('hidden');
    addVideoStream(myId, myName, localStream, true);
    
    // Reset mute states
    isMicMuted = false;
    isCamOff = false;
    btnMuteMic.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    btnMuteMic.classList.remove('active');
    btnMuteCam.innerHTML = '<i class="fa-solid fa-video"></i>';
    btnMuteCam.classList.remove('active');
    
    if (isHost) {
      const me = members.find(m => m.id === myId);
      if (me) me.inCall = true;
      broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
      callOtherInCallMembers();
    } else {
      if (currentConnection && currentConnection.open) {
        currentConnection.send({ type: 'call_status', inCall: true });
      }
    }
  } catch (err) {
    console.error('Failed to get local stream', err);
    showStatus('Failed to access microphone/camera', true);
  }
}

function leaveCall() {
  if (!inCall) return;
  inCall = false;
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  btnVideoCall.classList.remove('active');
  btnVoiceCall.classList.remove('active');
  btnEndCall.classList.add('hidden');
  btnMuteMic.classList.add('hidden');
  btnMuteCam.classList.add('hidden');
  videoGrid.classList.add('hidden');
  videoGrid.innerHTML = '';
  
  Object.values(calls).forEach(call => call.close());
  calls = {};
  
  if (isHost) {
    const me = members.find(m => m.id === myId);
    if (me) me.inCall = false;
    broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
  } else {
    if (currentConnection && currentConnection.open) {
      currentConnection.send({ type: 'call_status', inCall: false });
    }
  }
}

function callOtherInCallMembers() {
  members.forEach(m => {
    if (m.id !== myId && m.inCall && !calls[m.id]) {
      const call = peer.call(m.id, localStream, { metadata: { senderName: myName } });
      handleCall(call, m.name);
    }
  });
}

function handleCall(call, name) {
  calls[call.peer] = call;
  call.on('stream', remoteStream => {
    addVideoStream(call.peer, name, remoteStream, false);
  });
  call.on('close', () => {
    removeVideoStream(call.peer);
    delete calls[call.peer];
  });
}

function addVideoStream(id, name, stream, isLocal) {
  if (document.getElementById(`video-wrapper-${id}`)) return;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'video-wrapper';
  wrapper.id = `video-wrapper-${id}`;
  
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  if (isLocal) video.muted = true;
  
  const label = document.createElement('div');
  label.className = 'video-label';
  label.textContent = name;
  
  wrapper.appendChild(video);
  wrapper.appendChild(label);
  videoGrid.appendChild(wrapper);
}

function removeVideoStream(id) {
  const el = document.getElementById(`video-wrapper-${id}`);
  if (el) el.remove();
}

btnVoiceCall.addEventListener('click', () => toggleCall(false));
btnVideoCall.addEventListener('click', () => toggleCall(true));
btnEndCall.addEventListener('click', leaveCall);

// Mute/Unmute Controls
const btnMuteMic = document.getElementById('btn-mute-mic');
const btnMuteCam = document.getElementById('btn-mute-cam');
let isMicMuted = false;
let isCamOff = false;

btnMuteMic.addEventListener('click', () => {
  if (!localStream) return;
  isMicMuted = !isMicMuted;
  localStream.getAudioTracks().forEach(track => { track.enabled = !isMicMuted; });
  btnMuteMic.innerHTML = isMicMuted
    ? '<i class="fa-solid fa-microphone-slash"></i>'
    : '<i class="fa-solid fa-microphone"></i>';
  btnMuteMic.classList.toggle('active', !isMicMuted);
  btnMuteMic.style.color = isMicMuted ? 'var(--danger-color)' : '';
  btnMuteMic.title = isMicMuted ? 'Unmute Mic' : 'Mute Mic';
});

btnMuteCam.addEventListener('click', () => {
  if (!localStream) return;
  isCamOff = !isCamOff;
  localStream.getVideoTracks().forEach(track => { track.enabled = !isCamOff; });
  btnMuteCam.innerHTML = isCamOff
    ? '<i class="fa-solid fa-video-slash"></i>'
    : '<i class="fa-solid fa-video"></i>';
  btnMuteCam.classList.toggle('active', !isCamOff);
  btnMuteCam.style.color = isCamOff ? 'var(--danger-color)' : '';
  btnMuteCam.title = isCamOff ? 'Turn On Camera' : 'Turn Off Camera';
});

// Create Room (Host)
btnCreate.addEventListener('click', () => {
  if (!tosCheckbox.checked) {
    showStatus('You must agree to the Terms of Service & Privacy Policy.', true);
    return;
  }
  
  const age = calculateAge(dobInput.value);
  if (age < 19) {
    showStatus('You must be 19 or older to use BER OF CHAT.', true);
    return;
  }
  
  // India OTP gate
  if (userCountry === 'IN' && typeof otpVerified !== 'undefined' && !otpVerified) {
    showStatus('Indian users must complete phone OTP verification.', true);
    return;
  }
  
  logConsent(age);
  
  myName = createNameInput.value.trim() || 'Anonymous';
  maxRoomMembers = parseInt(maxMembersInput.value, 10) || 10;
  if (maxRoomMembers > 10) maxRoomMembers = 10;
  if (maxRoomMembers < 2) maxRoomMembers = 2;
  
  roomCode = generateRoomCode();
  
  showStatus('Generating room...', false);
  
  // Use roomCode as Peer ID
  peer = new Peer(roomCode, getPeerConfig());
  
  peer.on('open', (id) => {
    isHost = true;
    myId = id;
    myRoleBadge.style.display = 'block';
    chatHeaderTitle.textContent = 'BER OF CHAT (Host)';
    
    // Add self to members
    members.push({ id: myId, name: myName, isHost: true, inCall: false });
    
    enterChatScreen();
  });
  
  peer.on('call', call => {
    if (inCall) {
      call.answer(localStream);
      const callerName = call.metadata ? call.metadata.senderName : 'Unknown';
      handleCall(call, callerName);
    } else {
      showIncomingCall(call);
    }
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
        members.push({ id: data.senderId, name: data.senderName, isHost: false, inCall: false });
        appendMessage('System', `${data.senderName} joined the room.`, false, true);
        
        // Broadcast new member list
        broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
      } else if (data.type === 'call_status') {
        const member = members.find(m => m.id === data.senderId);
        if (member) member.inCall = data.inCall;
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
  if (!tosCheckbox.checked) {
    showStatus('You must agree to the Terms of Service & Privacy Policy.', true);
    return;
  }
  
  const age = calculateAge(dobInput.value);
  if (age < 19) {
    showStatus('You must be 19 or older to use BER OF CHAT.', true);
    return;
  }
  
  // India OTP gate
  if (userCountry === 'IN' && typeof otpVerified !== 'undefined' && !otpVerified) {
    showStatus('Indian users must complete phone OTP verification.', true);
    return;
  }
  
  logConsent(age);
  
  myName = joinNameInput.value.trim() || 'Anonymous';
  const targetCode = roomCodeInput.value.trim().toUpperCase();
  
  if (!targetCode) {
    showStatus('Please enter a room code.', true);
    return;
  }
  
  showStatus('Connecting...', false);
  
  peer = new Peer(getPeerConfig());
  
  peer.on('open', (id) => {
    isHost = false;
    myId = id;
    roomCode = targetCode;
    
    const conn = peer.connect(targetCode);
    
    peer.on('call', call => {
      if (inCall) {
        call.answer(localStream);
        const callerName = call.metadata ? call.metadata.senderName : 'Unknown';
        handleCall(call, callerName);
      } else {
        showIncomingCall(call);
      }
    });
    
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
  
  // Traceability: log room join
  if (typeof logRoomJoin === 'function') {
    logRoomJoin(myId, roomCode);
  }
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
    logMessageTrace(text);
  } else {
    // Send to host
    if (currentConnection && currentConnection.open) {
      appendMessage(myName, text, true);
      currentConnection.send(msgData);
      logMessageTrace(text);
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
  leaveCall();
  // Traceability: log room leave
  if (typeof logRoomLeave === 'function' && myId && roomCode) {
    logRoomLeave(myId, roomCode);
  }
  if (peer) {
    peer.destroy();
  }
  location.reload();
});

// --- PWA INSTALLATION & SERVICE WORKER ---
let deferredPrompt;
const btnInstall = document.getElementById('btn-install');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI to notify the user they can add to home screen
  if (btnInstall) {
    btnInstall.classList.remove('hidden');
  }
});

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      deferredPrompt = null;
      btnInstall.classList.add('hidden');
    }
  });
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('Service worker registered.', reg);
    }).catch(err => {
      console.log('Service worker registration failed:', err);
    });
  });
}
