/* BER OF CHAT production hardening and UX enhancements.
 * Loaded by the service worker HTML injector. Keep this file dependency-free.
 */
(function () {
  'use strict';

  const APP_VERSION = '2.4.0';
  const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const $ = (id) => document.getElementById(id);
  const safeText = (value) => String(value == null ? '' : value);

  function randomString(length) {
    const bytes = new Uint8Array(length);
    if (window.crypto && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += ROOM_CODE_CHARS[bytes[i] % ROOM_CODE_CHARS.length];
    return out;
  }

  // Stronger room IDs and consent IDs. The original handlers call these names at runtime.
  try {
    generateRoomCode = function generateSecureRoomCode() {
      return randomString(8);
    };
  } catch (err) {
    console.warn('[BER] Could not override room-code generator:', err);
  }

  try {
    generateUUID = function generateSecureUUID() {
      return crypto.randomUUID ? crypto.randomUUID() : randomString(32);
    };
  } catch (err) {
    console.warn('[BER] Could not override UUID generator:', err);
  }

  // Better ICE defaults. Public demo TURN credentials remain only a fallback; use your own TURN in production.
  try {
    getPeerConfig = function getImprovedPeerConfig() {
      const maskIp = $('mask-ip-checkbox') ? $('mask-ip-checkbox').checked : false;
      const config = {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] }
        ],
        iceCandidatePoolSize: 8,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      if (maskIp) {
        config.iceServers.push(
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
        );
        config.iceTransportPolicy = 'relay';
      }
      return config;
    };
  } catch (err) {
    console.warn('[BER] Could not override peer config:', err);
  }

  function injectStyles() {
    if ($('ber-enhancement-styles')) return;
    const style = document.createElement('style');
    style.id = 'ber-enhancement-styles';
    style.textContent = `
      .ber-help-card,.ber-legal-card,.ber-call-toolbar,.ber-quality-pill{border:1px solid rgba(15,23,42,.1);background:rgba(255,255,255,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 14px 38px rgba(15,23,42,.08)}
      .ber-help-card,.ber-legal-card{margin-top:14px;padding:14px;border-radius:18px;color:#334155;font-size:13px;line-height:1.55}
      .ber-help-card strong,.ber-legal-card strong{display:block;color:#0f172a;margin-bottom:6px;font-size:14px}
      .ber-help-card ol{margin:8px 0 0 18px;padding:0}.ber-help-card li{margin:4px 0}
      .ber-legal-card{background:rgba(255,251,235,.88);border-color:rgba(245,158,11,.28)}
      .ber-legal-card a{font-weight:800}.ber-muted{color:#64748b;font-size:12px}.ber-version{margin-top:8px;text-align:center;color:#94a3b8;font-size:11px}
      .ber-call-toolbar{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:0 0 18px 18px;margin:0 20px 8px}
      .ber-quality-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;color:#334155;font-size:12px;font-weight:800}.ber-quality-pill.good{color:#047857}.ber-quality-pill.warn{color:#b45309}.ber-quality-pill.bad{color:#dc2626}
      .video-wrapper{position:relative;overflow:hidden;border-radius:18px;background:#020617;min-height:180px}.video-wrapper video{width:100%;height:100%;min-height:180px;object-fit:cover;background:#020617}.video-label{position:absolute;left:10px;bottom:10px;z-index:2;padding:6px 9px;border-radius:999px;background:rgba(15,23,42,.72);color:white;font-size:12px;font-weight:800}.video-wrapper.local-video::after{content:'You';position:absolute;right:10px;top:10px;padding:5px 8px;border-radius:999px;background:rgba(16,185,129,.9);color:#fff;font-size:11px;font-weight:900}
      .message-wrapper .message{white-space:pre-wrap;word-break:break-word}.search-highlight{outline:3px solid rgba(245,158,11,.45)}
      .ber-toast{position:fixed;left:50%;bottom:22px;z-index:10050;transform:translateX(-50%);max-width:min(92vw,520px);padding:12px 15px;border-radius:15px;background:#0f172a;color:#fff;box-shadow:0 18px 48px rgba(15,23,42,.28);font-weight:800;font-size:13px;text-align:center}
      @media(max-width:768px){.ber-call-toolbar{margin:0 10px 8px;flex-wrap:wrap}.ber-help-card,.ber-legal-card{font-size:12px}.video-wrapper video{min-height:220px}}
    `;
    document.head.appendChild(style);
  }

  function toast(message) {
    const old = document.querySelector('.ber-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'ber-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  function addEntryHelp() {
    const panel = document.querySelector('#entry-screen .glass-panel');
    if (!panel || $('ber-help-card')) return;

    const help = document.createElement('section');
    help.id = 'ber-help-card';
    help.className = 'ber-help-card';
    help.innerHTML = `
      <strong>How private rooms work</strong>
      <ol>
        <li>Create a room and share the code only with trusted people.</li>
        <li>Join with a code to chat, start voice, or start video.</li>
        <li>The host keeps the room open. If the host leaves, the room closes.</li>
      </ol>
      <p class="ber-muted">Tip: turn on <b>Mask IP / relay</b> for more privacy. Calls may connect slower when relay mode is used.</p>
    `;

    const legal = document.createElement('section');
    legal.id = 'ber-legal-card';
    legal.className = 'ber-legal-card';
    legal.innerHTML = `
      <strong>Privacy and legal notice</strong>
      Laws differ by country. Use this app only where private messaging and internet calls are allowed. Do not use it for illegal, abusive, sexual exploitation, terrorist, fraud, spam, or harassment content. This app may store local consent records and message hashes for safety/legal traceability where enabled.
      <div class="ber-muted">This is a technical notice, not legal advice. Get local legal review before public launch in any country.</div>
    `;

    panel.appendChild(help);
    panel.appendChild(legal);

    const version = document.createElement('div');
    version.className = 'ber-version';
    version.textContent = `Version ${APP_VERSION} · Safer room codes · Better call UI`;
    panel.appendChild(version);
  }

  function improveInputs() {
    const roomInput = $('room-code-input');
    if (roomInput) {
      roomInput.placeholder = 'Enter room code, e.g. 8XQ7M2LP';
      roomInput.autocapitalize = 'characters';
      roomInput.autocomplete = 'one-time-code';
      roomInput.maxLength = 12;
      roomInput.addEventListener('input', () => {
        roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      });
    }

    const guestName = $('guest-name-input');
    if (guestName) {
      guestName.placeholder = 'Display name shown in this room';
      guestName.maxLength = 32;
    }

    const maxMembers = $('max-members-create');
    if (maxMembers) {
      maxMembers.min = '2';
      maxMembers.max = '10';
      maxMembers.title = 'Keep rooms small for the best P2P calling quality.';
    }

    [['btn-create', 'Create secure room'], ['btn-join', 'Join room'], ['btn-voice-call', 'Start voice call'], ['btn-video-call', 'Start video call'], ['btn-end-call', 'End call'], ['btn-mute-mic', 'Mute or unmute microphone'], ['btn-mute-cam', 'Turn camera on or off'], ['btn-leave', 'Leave room']].forEach(([id, label]) => {
      const el = $(id);
      if (el) el.setAttribute('aria-label', label);
    });
  }

  function addCallToolbar() {
    const chatArea = document.querySelector('.chat-area');
    if (!chatArea || $('ber-call-toolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'ber-call-toolbar';
    toolbar.className = 'ber-call-toolbar';
    toolbar.innerHTML = `
      <div class="ber-quality-pill" id="ber-connection-pill"><i class="fa-solid fa-circle-info"></i> Ready</div>
      <div class="ber-muted">Small rooms work best for video. Use headphones to reduce echo.</div>
    `;
    const header = document.querySelector('.chat-header');
    if (header && header.nextSibling) chatArea.insertBefore(toolbar, header.nextSibling);
    else chatArea.prepend(toolbar);
  }

  function setConnectionPill(text, mode) {
    const pill = $('ber-connection-pill');
    if (!pill) return;
    pill.className = `ber-quality-pill ${mode || ''}`;
    pill.innerHTML = `<i class="fa-solid fa-signal"></i> ${safeText(text)}`;
  }

  // Better call start: clearer media constraints, device checks, and status messages.
  try {
    toggleCall = async function improvedToggleCall(withVideo = false) {
      if (callingRestricted) {
        toast('Voice/video calling is restricted in your detected region.');
        return;
      }
      if (inCall) {
        leaveCall();
        setConnectionPill('Call ended', 'warn');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('Your browser does not support secure camera/microphone calling.');
        return;
      }
      try {
        isVideo = !!withVideo;
        setConnectionPill(withVideo ? 'Starting video…' : 'Starting voice…', 'warn');
        const constraints = {
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' } : false
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        inCall = true;
        if ($('btn-end-call')) $('btn-end-call').classList.remove('hidden');
        if ($('btn-mute-mic')) $('btn-mute-mic').classList.remove('hidden');
        if ($('btn-mute-cam')) $('btn-mute-cam').classList.toggle('hidden', !withVideo);
        if (videoGrid) videoGrid.classList.remove('hidden');
        addVideoStream(myId, myName, localStream, true);
        setConnectionPill(withVideo ? 'Video live' : 'Voice live', 'good');

        if (isHost) {
          const selfMember = members.find(m => m.id === myId);
          if (selfMember) selfMember.inCall = true;
          broadcastToAll({ type: 'members_update', members, maxMembers: maxRoomMembers });
          callOtherInCallMembers();
        } else {
          currentConnection?.send({ type: 'call_status', inCall: true, senderId: myId });
          callOtherInCallMembers();
        }
      } catch (err) {
        console.error('[BER] Media access failed:', err);
        setConnectionPill('Media blocked', 'bad');
        toast('Camera or microphone permission failed. Check browser permissions and HTTPS.');
      }
    };
  } catch (err) {
    console.warn('[BER] Could not improve call start:', err);
  }

  try {
    const originalLeaveCall = leaveCall;
    leaveCall = function improvedLeaveCall() {
      originalLeaveCall();
      setConnectionPill('Ready', '');
    };
  } catch (err) {}

  try {
    addVideoStream = function improvedAddVideoStream(id, name, stream, isLocal) {
      if (!videoGrid) return;
      let wrapper = document.getElementById(`video-wrapper-${id}`);
      if (wrapper) {
        const existing = wrapper.querySelector('video');
        if (existing && existing.srcObject !== stream) existing.srcObject = stream;
        return;
      }
      wrapper = document.createElement('div');
      wrapper.className = `video-wrapper${isLocal ? ' local-video' : ''}`;
      wrapper.id = `video-wrapper-${id}`;
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = !!isLocal;
      video.setAttribute('aria-label', `${name || 'Participant'} video`);
      const label = document.createElement('div');
      label.className = 'video-label';
      label.textContent = safeText(name || 'Participant');
      wrapper.append(video, label);
      wrapper.addEventListener('dblclick', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else wrapper.requestFullscreen?.();
      });
      videoGrid.appendChild(wrapper);
    };
  } catch (err) {
    console.warn('[BER] Could not improve video rendering:', err);
  }

  function addSafetyHandlers() {
    window.addEventListener('beforeunload', (event) => {
      try {
        if (chatScreen && chatScreen.classList.contains('active')) {
          event.preventDefault();
          event.returnValue = 'Leave this private room?';
        }
      } catch (err) {}
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && inCall) setConnectionPill('Call running in background', 'warn');
      else if (inCall) setConnectionPill(isVideo ? 'Video live' : 'Voice live', 'good');
    });
  }

  function init() {
    injectStyles();
    addEntryHelp();
    improveInputs();
    addCallToolbar();
    addSafetyHandlers();
    setTimeout(addCallToolbar, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
