/* ============================================================
   app.js — QUICK PRIVATE CHAT by SHADER7
   Ready version: max 4 users, PeerJS-only, no Supabase

   Features:
   - Max 4 members in lobby
   - Host creates short room code
   - Join by room code or ?room=ABC123 invite link
   - Host leaving closes room for everyone
   - Text chat
   - Group voice/video for up to 4 users
   - If already in call, extra mesh calls auto-answer
   - Call declined / call ended messages
   - Message timestamps (HH:MM 12h)
   - Typing indicator with debounce
   - Delivery ticks (✓ sent, ✓✓ delivered)
   - Sound notifications (Web Audio API)
   - Browser notifications
   - Scroll-to-bottom with unread badge
   - Heartbeat / presence system
   - Auto-reconnection with exponential backoff
   - Search messages with highlight
   - Keyboard shortcuts
   - Title badge for unread count
   - Attach button feedback
   - Long-press / right-click copy
   - Floating call controls bar
   - Emoji category tabs with recent emojis
   ============================================================ */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const MAX_ROOM_MEMBERS = 4;

  /* ──── Existing DOM references ──── */
  const entryScreen = $("#entry-screen");
  const chatScreen = $("#chat-screen");
  const sidebar = $("#sidebar");

  const guestNameInput = $("#guest-name-input");
  const roomCodeInput = $("#room-code-input");
  const dobInput = $("#dob-input");
  const tosCheckbox = $("#tos-checkbox");
  const maxMembersInput = $("#max-members-create");
  const entryStatus = $("#entry-status");

  const btnCreate = $("#btn-create");
  const btnJoin = $("#btn-join");
  const btnLeave = $("#btn-leave");
  const btnSend = $("#btn-send");

  const messageInput = $("#message-input");
  const messagesContainer = $("#messages-container");

  const displayRoomCode = $("#display-room-code");
  const chatHeaderTitle = $("#chat-header-title");
  const memberCount = $("#member-count");
  const membersList = $("#members-list");
  const myRoleBadge = $("#my-role-badge");
  const myNameLabel = $("#my-name");
  const myAvatar = $("#my-avatar");
  const connectionStatus = $("#connection-status");

  const btnMenu = $("#btn-menu");
  const btnCloseSidebar = $("#btn-close-sidebar");
  const copyCodeBtn = $("#copy-code-btn");
  const copyInviteBtn = $("#copy-invite-btn");

  const videoGrid = $("#video-grid");
  const incomingCallModal = $("#incoming-call-modal");
  const callerNameDisplay = $("#caller-name-display");
  const btnAcceptCall = $("#btn-accept-call");
  const btnDeclineCall = $("#btn-decline-call");
  const btnVoiceCall = $("#btn-voice-call");
  const btnVideoCall = $("#btn-video-call");
  const btnMuteMic = $("#btn-mute-mic");
  const btnMuteCam = $("#btn-mute-cam");
  const btnEndCall = $("#btn-end-call");

  /* ──── New DOM references (added by parallel HTML agent) ──── */
  const typingIndicator = $("#typing-indicator");
  const scrollToBottomBtn = $("#scroll-to-bottom");
  const unreadBadge = $("#unread-badge");
  const searchBar = $("#search-bar");
  const searchInput = $("#search-input");
  const btnCloseSearch = $("#btn-close-search");
  const messageContextMenu = $("#message-context-menu");
  const btnContextCopy = $("#btn-context-copy");
  const callControlsBar = $("#call-controls-bar");
  const ctrlMuteMic = $("#ctrl-mute-mic");
  const ctrlMuteCam = $("#ctrl-mute-cam");
  const ctrlEndCall = $("#ctrl-end-call");
  const btnSearch = $("#btn-search");

  /* ──── Existing state ──── */
  let peer = null;
  let myPeerId = "";
  let roomCode = "";
  let myName = "";
  let isHost = false;
  let roomMaxMembers = MAX_ROOM_MEMBERS;

  const connections = new Map();
  const members = new Map();

  let localStream = null;
  const activeCalls = new Map();
  const callConnectedPeers = new Set();
  const answeredIncomingPeers = new Set();

  let groupCallActive = false;
  let groupCallMediaType = "voice";
  let groupCallStarterId = "";
  let pendingCall = null;

  let isMicMuted = false;
  let isCamOff = false;
  let lastMessageTime = 0;
  let roomClosedByHost = false;

  /* ──── New state for features ──── */
  const messageElements = new Map();           // msgId → DOM element for delivery ticks
  const lastHeartbeats = new Map();            // peerId → timestamp
  let heartbeatInterval = null;

  let typingTimeout = null;                     // timer to send typing:false
  let typingDebounce = 0;                       // last time we sent typing:true
  let typingClearTimers = new Map();            // peerId → timer to clear indicator

  let unreadCount = 0;
  let scrollUnreadCount = 0;
  const originalTitle = document.title;

  let audioCtx = null;
  let notificationPermissionRequested = false;

  let isUserLeaving = false;                    // flag to suppress reconnect on intentional leave
  let reconnectAttempts = new Map();            // peerId → { count, timer }

  let longPressTimer = null;
  let longPressTouchStart = null;
  let contextMenuTargetText = "";

  let searchActive = false;

  window.__qpcCoreReady = true;

  /* ============================================================
     UTILITY FUNCTIONS
     ============================================================ */

  function sanitize(value, max = 50) {
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function setEntryStatus(message, type = "error") {
    if (!entryStatus) return;
    entryStatus.textContent = message || "";
    entryStatus.style.color =
      type === "success" ? "var(--success-color)" :
      type === "warning" ? "var(--warning-color)" :
      "var(--danger-color)";
  }

  function setConnectionStatus(text, state = "ready") {
    if (!connectionStatus) return;
    connectionStatus.classList.remove("connected", "offline");
    connectionStatus.innerHTML =
      '<span class="connection-dot" aria-hidden="true"></span> ' +
      sanitize(text, 40);

    if (state === "connected") connectionStatus.classList.add("connected");
    if (state === "offline") connectionStatus.classList.add("offline");
  }

  function generateRoomCode(length = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    if (window.crypto && crypto.getRandomValues) {
      const values = new Uint32Array(length);
      crypto.getRandomValues(values);

      for (let i = 0; i < length; i++) {
        code += chars[values[i] % chars.length];
      }

      return code;
    }

    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
  }

  function generateMsgId() {
    return Date.now() + Math.random().toString(36).slice(2, 6);
  }

  function formatTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      date = new Date();
    }
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const mm = minutes < 10 ? "0" + minutes : String(minutes);
    return hours + ":" + mm + " " + ampm;
  }

  function getAgeFromDob(dobValue) {
    if (!dobValue) return null;

    const birthDate = new Date(dobValue + "T00:00:00");
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    return age;
  }

  function getSelectedMaxMembers() {
    const value = Number(maxMembersInput?.value || MAX_ROOM_MEMBERS);
    if (!Number.isFinite(value)) return MAX_ROOM_MEMBERS;

    return Math.max(2, Math.min(MAX_ROOM_MEMBERS, Math.floor(value)));
  }

  function validateEntry(requireRoomCode) {
    const name = sanitize(guestNameInput?.value, 20);
    const age = getAgeFromDob(dobInput?.value || "");
    const agreed = Boolean(tosCheckbox?.checked);
    const inputRoom = sanitize(roomCodeInput?.value, 8).toUpperCase();

    if (!name) {
      setEntryStatus("Please enter your display name.");
      guestNameInput?.focus();
      return false;
    }

    if (age === null) {
      setEntryStatus("Please enter a valid date of birth.");
      dobInput?.focus();
      return false;
    }

    if (age < 19) {
      setEntryStatus("You must be 19 or older to use this service.");
      dobInput?.focus();
      return false;
    }

    if (!agreed) {
      setEntryStatus("Please agree to the Terms of Service and Privacy Policy.");
      tosCheckbox?.focus();
      return false;
    }

    if (requireRoomCode && !inputRoom) {
      setEntryStatus("Please enter a room code.");
      roomCodeInput?.focus();
      return false;
    }

    return true;
  }

  /* ============================================================
     FEATURE 1 & 3: MESSAGE DISPLAY (timestamps, ticks, msgId)
     ============================================================ */

  function addSystemMessage(text) {
    if (!messagesContainer) return;

    const wrap = document.createElement("div");
    wrap.className = "system-msg";

    const content = document.createElement("div");
    content.className = "sys-content";
    content.textContent = text;

    const timeSpan = document.createElement("span");
    timeSpan.className = "msg-time";
    timeSpan.textContent = " · " + formatTime(new Date());
    content.appendChild(timeSpan);

    wrap.appendChild(content);
    messagesContainer.appendChild(wrap);
    autoScrollOrTrackUnread();
  }

  function addChatMessage(sender, text, isOwn, msgId, timestamp) {
    if (!messagesContainer) return null;

    const msg = document.createElement("div");
    msg.className = isOwn ? "message-bubble own" : "message-bubble other";

    const nameEl = document.createElement("strong");
    nameEl.textContent = sender;

    const textEl = document.createElement("span");
    textEl.className = "msg-text";
    textEl.textContent = text;

    const metaRow = document.createElement("span");
    metaRow.className = "msg-meta";

    const timeSpan = document.createElement("span");
    timeSpan.className = "msg-time";
    const ts = timestamp ? new Date(timestamp) : new Date();
    timeSpan.textContent = formatTime(ts);
    metaRow.appendChild(timeSpan);

    if (isOwn && msgId) {
      const tickSpan = document.createElement("span");
      tickSpan.className = "msg-ticks";
      tickSpan.textContent = "✓";
      metaRow.appendChild(tickSpan);
      messageElements.set(String(msgId), tickSpan);
    }

    msg.appendChild(nameEl);
    msg.appendChild(textEl);
    msg.appendChild(metaRow);
    messagesContainer.appendChild(msg);
    autoScrollOrTrackUnread();

    return msg;
  }

  function autoScrollOrTrackUnread() {
    if (!messagesContainer) return;
    const threshold = 200;
    const distanceFromBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;

    if (distanceFromBottom <= threshold) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      scrollUnreadCount = 0;
      updateUnreadBadge();
    } else {
      scrollUnreadCount++;
      updateUnreadBadge();
      showScrollToBottom(true);
    }
  }

  /* ============================================================
     FEATURE 6: SCROLL-TO-BOTTOM BUTTON
     ============================================================ */

  function showScrollToBottom(show) {
    if (!scrollToBottomBtn) return;
    if (show) {
      scrollToBottomBtn.classList.remove("hidden");
    } else {
      scrollToBottomBtn.classList.add("hidden");
    }
  }

  function updateUnreadBadge() {
    if (!unreadBadge) return;
    if (scrollUnreadCount > 0) {
      unreadBadge.textContent = String(scrollUnreadCount);
      unreadBadge.classList.remove("hidden");
    } else {
      unreadBadge.textContent = "";
      unreadBadge.classList.add("hidden");
    }
  }

  function initScrollToBottom() {
    messagesContainer?.addEventListener("scroll", () => {
      if (!messagesContainer) return;
      const distanceFromBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
      if (distanceFromBottom > 200) {
        showScrollToBottom(true);
      } else {
        showScrollToBottom(false);
        scrollUnreadCount = 0;
        updateUnreadBadge();
      }
    });

    scrollToBottomBtn?.addEventListener("click", () => {
      if (!messagesContainer) return;
      messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: "smooth" });
      scrollUnreadCount = 0;
      updateUnreadBadge();
      showScrollToBottom(false);
    });
  }

  /* ============================================================
     FEATURE 4: SOUND NOTIFICATIONS (Web Audio API)
     ============================================================ */

  function getAudioContext() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playNotificationSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(800, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1000, now + 0.1);
      gain2.gain.setValueAtTime(0.15, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.2);
    } catch (e) {}
  }

  function playRingtoneSound() {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const tones = [600, 800, 1000];

      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0.18, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.14);
      });
    } catch (e) {}
  }

  function vibrateIfSupported() {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {}
  }

  /* ============================================================
     FEATURE 5: BROWSER NOTIFICATIONS
     ============================================================ */

  function requestNotificationPermission() {
    if (notificationPermissionRequested) return;
    notificationPermissionRequested = true;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }

  function showBrowserNotification(senderName, messagePreview) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden) return;

    try {
      const notif = new Notification(senderName + " says:", {
        body: messagePreview.slice(0, 100),
        icon: undefined,
        tag: "qpc-msg-" + Date.now()
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      setTimeout(() => { try { notif.close(); } catch (e) {} }, 5000);
    } catch (e) {}
  }

  /* ============================================================
     FEATURE 11: TITLE BADGE
     ============================================================ */

  function updateTitleBadge() {
    if (unreadCount > 0 && roomCode) {
      document.title = "(" + unreadCount + ") Room " + roomCode + " — Quick Private Chat";
    } else {
      document.title = originalTitle;
    }
  }

  function initVisibilityChange() {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        unreadCount = 0;
        updateTitleBadge();
      }
    });
  }

  /* ============================================================
     FEATURE 2: TYPING INDICATOR
     ============================================================ */

  function broadcastTyping(isTyping) {
    sendToAll({
      type: "typing",
      name: myName,
      isTyping: isTyping
    });
  }

  function handleTypingInput() {
    const now = Date.now();

    if (now - typingDebounce >= 2000) {
      typingDebounce = now;
      broadcastTyping(true);
    }

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      broadcastTyping(false);
      typingTimeout = null;
    }, 3000);
  }

  function showTypingIndicator(name) {
    if (!typingIndicator) return;
    typingIndicator.innerHTML = "<strong>" + sanitize(name, 20) + "</strong> is typing" +
      '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
    typingIndicator.classList.remove("hidden");
  }

  function hideTypingIndicator() {
    if (!typingIndicator) return;
    typingIndicator.innerHTML = "";
    typingIndicator.classList.add("hidden");
  }

  function handleTypingMessage(senderId, data) {
    if (senderId === myPeerId) return;

    const peerName = data.name || members.get(senderId)?.name || "Someone";

    if (typingClearTimers.has(senderId)) {
      clearTimeout(typingClearTimers.get(senderId));
    }

    if (data.isTyping) {
      showTypingIndicator(peerName);

      const timer = setTimeout(() => {
        hideTypingIndicator();
        typingClearTimers.delete(senderId);
      }, 4000);
      typingClearTimers.set(senderId, timer);
    } else {
      hideTypingIndicator();
      typingClearTimers.delete(senderId);
    }
  }

  /* ============================================================
     FEATURE 3: DELIVERY TICKS (msg-ack)
     ============================================================ */

  function handleMsgAck(data) {
    const id = String(data.msgId || "");
    if (!id) return;

    const tickEl = messageElements.get(id);
    if (tickEl) {
      tickEl.textContent = "✓✓";
      tickEl.classList.add("delivered");
    }
  }

  function sendMsgAck(senderId, msgId) {
    if (!msgId) return;
    sendToPeer(senderId, {
      type: "msg-ack",
      msgId: msgId
    });
  }

  /* ============================================================
     FEATURE 7: HEARTBEAT / PRESENCE
     ============================================================ */

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
      if (!roomCode || !myPeerId) return;
      sendToAll({
        type: "heartbeat",
        id: myPeerId,
        time: Date.now()
      });
      lastHeartbeats.set(myPeerId, Date.now());
    }, 8000);
    lastHeartbeats.set(myPeerId, Date.now());
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    lastHeartbeats.clear();
  }

  function getPresenceClass(peerId) {
    const lastBeat = lastHeartbeats.get(peerId);
    if (!lastBeat) return "status-offline";

    const elapsed = Date.now() - lastBeat;
    if (elapsed <= 10000) return "status-online";
    if (elapsed <= 25000) return "status-away";
    return "status-offline";
  }

  /* ──── Members UI (enhanced with heartbeat dots) ──── */

  function updateMembersUI() {
    if (!membersList || !memberCount) return;

    membersList.innerHTML = "";

    members.forEach((info, peerId) => {
      const li = document.createElement("li");
      const statusClass = getPresenceClass(peerId);

      const dot = document.createElement("span");
      dot.className = "member-status-dot " + statusClass;
      dot.setAttribute("aria-hidden", "true");

      const text = document.createTextNode(" " + info.name + " — " + info.role);

      li.appendChild(dot);
      li.appendChild(text);
      li.setAttribute("data-peer-id", peerId);
      membersList.appendChild(li);
    });

    memberCount.textContent = String(members.size);
  }

  /* ============================================================
     SCREEN TRANSITIONS
     ============================================================ */

  function enterChatScreen(role) {
    const initial = myName.charAt(0).toUpperCase() || "U";

    if (displayRoomCode) displayRoomCode.textContent = roomCode;
    if (chatHeaderTitle) chatHeaderTitle.textContent = "Room " + roomCode;
    if (myRoleBadge) myRoleBadge.textContent = role;
    if (myNameLabel) myNameLabel.textContent = myName;
    if (myAvatar) myAvatar.textContent = initial;

    entryScreen?.classList.remove("active");
    chatScreen?.classList.add("active");
    sidebar?.classList.remove("active");

    setConnectionStatus(role === "Host" ? "Hosting" : "Connected", "connected");

    try {
      localStorage.setItem("qpc_last_name", myName);
      localStorage.setItem("qpc_last_room", roomCode);
    } catch (e) {}

    startHeartbeat();
  }

  function destroyPeer() {
    try {
      connections.forEach((conn) => {
        try {
          conn.close();
        } catch (e) {}
      });

      connections.clear();
      members.clear();

      if (peer && !peer.destroyed) {
        peer.destroy();
      }
    } catch (e) {}

    peer = null;
    myPeerId = "";
    stopHeartbeat();
  }

  /* ============================================================
     PEERJS CONNECTION
     ============================================================ */

  function createPeer(id) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === "undefined") {
        reject(new Error("PeerJS library did not load."));
        return;
      }

      const p = new Peer(id, { debug: 1 });
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;

          try {
            p.destroy();
          } catch (e) {}

          reject(new Error("PeerJS connection timed out."));
        }
      }, 12000);

      p.on("open", (openedId) => {
        if (settled) return;

        settled = true;
        clearTimeout(timeout);

        resolve({
          peerInstance: p,
          id: openedId
        });
      });

      p.on("disconnected", () => {
        setConnectionStatus("Reconnecting...", "ready");

        try {
          p.reconnect();
        } catch (e) {}
      });

      p.on("close", () => {
        setConnectionStatus("Offline", "offline");
      });

      p.on("error", (err) => {
        console.error("[PeerJS error]", err);

        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        } else {
          addSystemMessage("Connection warning: " + (err?.message || "PeerJS error"));
          setConnectionStatus("Connection warning", "offline");
        }
      });
    });
  }

  /* ============================================================
     MESSAGING HELPERS
     ============================================================ */

  function sendToPeer(peerId, data) {
    const conn = connections.get(peerId);

    if (conn && conn.open) {
      try {
        conn.send(data);
      } catch (e) {}
    }
  }

  function sendToAll(data) {
    connections.forEach((conn) => {
      if (conn && conn.open) {
        try {
          conn.send(data);
        } catch (e) {}
      }
    });
  }

  function relayAsHost(senderId, data) {
    if (!isHost || !data || typeof data !== "object") return;
    if (data.__relayedByHost) return;

    const relayTypes = new Set([
      "message",
      "call-started",
      "call-declined",
      "call-ended",
      "room-closed",
      "msg-ack"
    ]);

    if (!relayTypes.has(data.type)) return;

    const relayed = {
      ...data,
      __relayedByHost: true,
      __originalSender: data.__originalSender || senderId
    };

    connections.forEach((conn, peerId) => {
      if (!conn || !conn.open || peerId === senderId) return;

      try {
        conn.send(relayed);
      } catch (e) {}
    });
  }

  function sendMemberListTo(conn) {
    const list = Array.from(members.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      role: info.role
    }));

    conn.send({
      type: "member-list",
      members: list,
      maxMembers: roomMaxMembers
    });
  }

  function broadcastMemberList() {
    const list = Array.from(members.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      role: info.role
    }));

    sendToAll({
      type: "member-list",
      members: list,
      maxMembers: roomMaxMembers
    });
  }

  function sendRoomClosedToAll() {
    sendToAll({
      type: "room-closed",
      name: myName || "Host"
    });
  }

  function forceExitRoom(message) {
    roomClosedByHost = true;
    isUserLeaving = true;

    addSystemMessage(message || "The host closed the room.");
    endCall(false, false);
    destroyPeer();

    roomCode = "";
    myName = "";
    isHost = false;

    setConnectionStatus("Room closed", "offline");

    setTimeout(() => {
      chatScreen?.classList.remove("active");
      entryScreen?.classList.add("active");
      sidebar?.classList.remove("active");
      updateMembersUI();
      setEntryStatus("The host closed the room. Create or join another room.", "warning");
      isUserLeaving = false;
    }, 800);
  }

  /* ============================================================
     FEATURE 8: AUTO-RECONNECTION
     ============================================================ */

  function attemptReconnect(peerId) {
    if (!roomCode || isUserLeaving || roomClosedByHost) return;
    if (!peer || peer.destroyed) return;

    const memberName = members.get(peerId)?.name || "peer";

    let attempt = reconnectAttempts.get(peerId);
    if (!attempt) {
      attempt = { count: 0, timer: null };
      reconnectAttempts.set(peerId, attempt);
    }

    if (attempt.count >= 3) {
      addSystemMessage("Lost connection to " + memberName + ".");
      reconnectAttempts.delete(peerId);
      return;
    }

    attempt.count++;
    const delay = Math.pow(2, attempt.count) * 1000;

    addSystemMessage("Reconnecting to " + memberName + "... (attempt " + attempt.count + "/3)");

    attempt.timer = setTimeout(() => {
      if (!peer || peer.destroyed || !roomCode) {
        reconnectAttempts.delete(peerId);
        return;
      }

      try {
        const conn = peer.connect(peerId, { reliable: true });
        setupConnection(conn, true);

        conn.on("open", () => {
          addSystemMessage("Reconnected to " + memberName + ".");
          reconnectAttempts.delete(peerId);
        });

        conn.on("error", () => {
          attemptReconnect(peerId);
        });
      } catch (e) {
        attemptReconnect(peerId);
      }
    }, delay);
  }

  /* ============================================================
     CONNECTION SETUP
     ============================================================ */

  function setupConnection(conn, isReconnectAttempt) {
    if (!conn) return;

    if (connections.has(conn.peer) && connections.get(conn.peer)?.open) {
      return;
    }

    connections.set(conn.peer, conn);

    conn.on("open", () => {
      conn.send({
        type: "hello",
        id: myPeerId,
        name: myName,
        role: isHost ? "Host" : "Member"
      });

      if (isHost) {
        sendMemberListTo(conn);
      }

      setConnectionStatus(isHost ? "Hosting" : "Connected", "connected");
    });

    conn.on("data", (data) => {
      handleData(conn.peer, data);
    });

    conn.on("close", () => {
      const wasMember = members.has(conn.peer);
      handleMemberLeft(conn.peer);

      if (wasMember && !isUserLeaving && !roomClosedByHost && roomCode) {
        attemptReconnect(conn.peer);
      }
    });

    conn.on("error", (err) => {
      console.warn("Connection error:", err);
      const wasMember = members.has(conn.peer);
      handleMemberLeft(conn.peer);

      if (wasMember && !isUserLeaving && !roomClosedByHost && roomCode && !isReconnectAttempt) {
        attemptReconnect(conn.peer);
      }
    });
  }

  /* ============================================================
     DATA HANDLER (main dispatch)
     ============================================================ */

  function handleData(senderId, data) {
    if (!data || typeof data !== "object") return;

    relayAsHost(senderId, data);

    if (data.type === "room-full") {
      setEntryStatus("Room is full. Maximum 4 users allowed.", "warning");
      addSystemMessage("Room is full. Maximum 4 users allowed.");

      try {
        connections.get(senderId)?.close();
      } catch (e) {}

      return;
    }

    if (data.type === "room-closed") {
      if (!isHost) {
        forceExitRoom((data.name || "The host") + " closed the room.");
      }

      return;
    }

    if (data.type === "hello") {
      const memberName = sanitize(data.name, 20) || "Unknown";

      if (isHost && !members.has(senderId) && members.size >= roomMaxMembers) {
        sendToPeer(senderId, {
          type: "room-full",
          maxMembers: roomMaxMembers
        });

        try {
          connections.get(senderId)?.close();
        } catch (e) {}

        addSystemMessage(memberName + " tried to join, but the room is full.");
        return;
      }

      members.set(senderId, {
        name: memberName,
        role: sanitize(data.role, 20) || "Member"
      });

      lastHeartbeats.set(senderId, Date.now());
      updateMembersUI();

      if (isHost) {
        addSystemMessage(memberName + " joined the room.");
        broadcastMemberList();
      }

      if (groupCallActive) {
        repairGroupCallMesh("new-member-hello");
      }

      return;
    }

    if (data.type === "member-list") {
      roomMaxMembers = Math.max(
        2,
        Math.min(MAX_ROOM_MEMBERS, Number(data.maxMembers || MAX_ROOM_MEMBERS))
      );

      members.clear();

      data.members.forEach((m) => {
        members.set(m.id, {
          name: sanitize(m.name, 20) || "Unknown",
          role: sanitize(m.role, 20) || "Member"
        });
        if (!lastHeartbeats.has(m.id)) {
          lastHeartbeats.set(m.id, Date.now());
        }
      });

      updateMembersUI();
      connectToAllKnownMembers();
      repairGroupCallMesh("member-list");
      return;
    }

    if (data.type === "message") {
      if (data.__originalSender && data.__originalSender === myPeerId) return;

      const effectiveSender = data.__originalSender || senderId;
      addChatMessage(data.name || "Someone", data.text || "", false, null, data.time);

      // Send ack back
      if (data.msgId) {
        sendMsgAck(effectiveSender, data.msgId);
      }

      // Request notification permission on first message
      requestNotificationPermission();

      // Sound & vibrate when tab hidden
      if (document.hidden) {
        playNotificationSound();
        vibrateIfSupported();
        unreadCount++;
        updateTitleBadge();
        showBrowserNotification(data.name || "Someone", data.text || "");
      }

      return;
    }

    if (data.type === "msg-ack") {
      handleMsgAck(data);
      return;
    }

    if (data.type === "typing") {
      handleTypingMessage(senderId, data);
      return;
    }

    if (data.type === "heartbeat") {
      lastHeartbeats.set(data.id || senderId, data.time || Date.now());
      return;
    }

    if (data.type === "member-left") {
      handleMemberLeft(data.id);
      return;
    }

    if (data.type === "call-started") {
      if (data.__originalSender && data.__originalSender === myPeerId) return;

      groupCallActive = true;
      groupCallMediaType = data.mediaType || "voice";
      groupCallStarterId = data.starterId || data.__originalSender || senderId || "";

      addSystemMessage(
        (data.name || "Someone") +
          " started a group " +
          groupCallMediaType +
          " call. Accept the call if prompted."
      );

      playRingtoneSound();

      connectToAllKnownMembers();
      repairGroupCallMesh("call-started-signal");
      return;
    }

    if (data.type === "call-declined") {
      if (data.__originalSender && data.__originalSender === myPeerId) return;

      addSystemMessage((data.name || "The other user") + " rejected the call.");
      return;
    }

    if (data.type === "call-ended") {
      if (data.__originalSender && data.__originalSender === myPeerId) return;

      groupCallActive = false;
      groupCallMediaType = "voice";
      groupCallStarterId = "";
      callConnectedPeers.clear();
      answeredIncomingPeers.clear();

      addSystemMessage((data.name || "Someone") + " ended the call.");
      endCallUI(false);
      return;
    }
  }

  /* ============================================================
     MEMBER CONNECTIONS
     ============================================================ */

  function connectToAllKnownMembers() {
    if (!peer || !myPeerId) return;

    members.forEach((info, peerId) => {
      if (!peerId || peerId === myPeerId) return;

      if (connections.has(peerId) && connections.get(peerId)?.open) {
        return;
      }

      try {
        const conn = peer.connect(peerId, { reliable: true });
        setupConnection(conn);
      } catch (error) {
        console.warn("Could not connect to member:", peerId, error);
      }
    });
  }

  function shouldInitiateMediaCall(peerId) {
    if (!peerId || !myPeerId || peerId === myPeerId) return false;
    return String(myPeerId) < String(peerId);
  }

  function hasStableMediaCall(peerId) {
    return (
      activeCalls.has(peerId) ||
      callConnectedPeers.has(peerId) ||
      answeredIncomingPeers.has(peerId)
    );
  }

  function callPeerIfNeeded(peerId, mediaType) {
    if (!peer || !localStream) return false;
    if (!peerId || peerId === myPeerId) return false;
    if (hasStableMediaCall(peerId)) return false;

    const iAmStarter = groupCallStarterId && myPeerId === groupCallStarterId;
    const peerIsStarter = groupCallStarterId && peerId === groupCallStarterId;

    if (!iAmStarter && !peerIsStarter && !shouldInitiateMediaCall(peerId)) {
      return false;
    }

    if (!iAmStarter && peerIsStarter) {
      return false;
    }

    try {
      const call = peer.call(peerId, localStream, {
        metadata: {
          callerName: myName,
          mediaType,
          groupCall: true,
          callFrom: myPeerId,
          starterId: groupCallStarterId || myPeerId
        }
      });

      setupMediaCall(call);
      return true;
    } catch (error) {
      console.warn("Could not call member:", peerId, error);
      return false;
    }
  }

  function callAllKnownMembers(mediaType) {
    if (!peer || !localStream) return 0;

    let count = 0;

    members.forEach((info, peerId) => {
      if (callPeerIfNeeded(peerId, mediaType)) {
        count++;
      }
    });

    return count;
  }

  function repairGroupCallMesh(reason = "repair") {
    if (!groupCallActive || !localStream) return;

    connectToAllKnownMembers();

    setTimeout(() => {
      const count = callAllKnownMembers(groupCallMediaType);

      if (count > 0) {
        console.log("[QPC] Group call mesh repair:", reason, "new calls:", count);
      }
    }, 450);
  }

  function handleMemberLeft(peerId) {
    if (!peerId || peerId === myPeerId) return;

    const oldMember = members.get(peerId);

    connections.delete(peerId);
    members.delete(peerId);
    lastHeartbeats.delete(peerId);

    const call = activeCalls.get(peerId);

    if (call) {
      try {
        call.close();
      } catch (e) {}

      activeCalls.delete(peerId);
    }

    callConnectedPeers.delete(peerId);
    answeredIncomingPeers.delete(peerId);
    removeRemoteVideo(peerId);
    updateMembersUI();

    if (oldMember) {
      addSystemMessage(oldMember.name + " left the room.");
    }

    if (isHost) {
      broadcastMemberList();
    }
  }

  /* ============================================================
     ROOM CREATION / JOINING
     ============================================================ */

  async function hostRoom() {
    if (!validateEntry(false)) return;

    destroyPeer();

    myName = sanitize(guestNameInput.value, 20);
    roomCode = generateRoomCode(6);
    isHost = true;
    roomClosedByHost = false;
    isUserLeaving = false;
    roomMaxMembers = getSelectedMaxMembers();

    setEntryStatus("Creating room...", "success");

    try {
      const result = await createPeer(roomCode);

      peer = result.peerInstance;
      myPeerId = result.id;

      peer.on("connection", (conn) => setupConnection(conn));
      peer.on("call", handleIncomingCall);

      members.set(myPeerId, {
        name: myName,
        role: "Host"
      });

      updateMembersUI();
      enterChatScreen("Host");

      addSystemMessage(
        "Room created. Share this room code or invite link only with people you know: " +
          roomCode +
          ". Limit: " +
          roomMaxMembers +
          " users. If the host leaves, everyone exits."
      );

      setEntryStatus("");
    } catch (err) {
      console.error(err);

      if (String(err?.type || "").includes("unavailable-id")) {
        setEntryStatus("Room code already exists. Try again.", "warning");
      } else {
        setEntryStatus("Could not create room. Check internet or refresh.");
      }
    }
  }

  async function joinRoom() {
    if (!validateEntry(true)) return;

    destroyPeer();

    myName = sanitize(guestNameInput.value, 20);
    roomCode = sanitize(roomCodeInput.value, 8).toUpperCase();
    isHost = false;
    roomClosedByHost = false;
    isUserLeaving = false;

    setEntryStatus("Joining room...", "success");

    try {
      const result = await createPeer(undefined);

      peer = result.peerInstance;
      myPeerId = result.id;

      peer.on("connection", (conn) => setupConnection(conn));
      peer.on("call", handleIncomingCall);

      members.set(myPeerId, {
        name: myName,
        role: "Member"
      });

      const conn = peer.connect(roomCode, {
        reliable: true
      });

      setupConnection(conn);

      conn.on("open", () => {
        updateMembersUI();
        enterChatScreen("Member");
        addSystemMessage("Joined room " + roomCode + ". Maximum 4 users. Keep this tab open for calls.");
        setEntryStatus("");
      });

      conn.on("error", (err) => {
        console.error("Join connection error:", err);
        setEntryStatus("Could not join room. Check the room code.");
      });

      setTimeout(() => {
        if (!conn.open && entryScreen?.classList.contains("active")) {
          setEntryStatus("Room not found or host is offline.", "warning");
        }
      }, 8000);
    } catch (err) {
      console.error(err);
      setEntryStatus("Could not connect. Check internet or refresh.");
    }
  }

  /* ============================================================
     SEND MESSAGE (enhanced with msgId, timestamp, typing reset)
     ============================================================ */

  function sendMessage() {
    const now = Date.now();

    if (now - lastMessageTime < 450) {
      addSystemMessage("Please wait a moment before sending another message.");
      return;
    }

    lastMessageTime = now;

    const text = sanitize(messageInput?.value, 1000);
    if (!text) return;

    const msgId = generateMsgId();
    const time = Date.now();

    addChatMessage(myName || "You", text, true, msgId, time);

    sendToAll({
      type: "message",
      name: myName || "Someone",
      text,
      msgId: msgId,
      time: time
    });

    messageInput.value = "";

    // Stop typing indicator for self
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
      broadcastTyping(false);
    }
  }

  function leaveRoom() {
    isUserLeaving = true;

    if (isHost) {
      sendRoomClosedToAll();
      addSystemMessage("You closed the room for everyone.");
    } else {
      sendToAll({
        type: "member-left",
        id: myPeerId
      });
    }

    endCall(false, false);
    destroyPeer();

    roomCode = "";
    myName = "";
    isHost = false;

    chatScreen?.classList.remove("active");
    entryScreen?.classList.add("active");
    sidebar?.classList.remove("active");

    setEntryStatus("");

    unreadCount = 0;
    updateTitleBadge();
    hideTypingIndicator();

    setTimeout(() => { isUserLeaving = false; }, 500);
  }

  /* ============================================================
     CALL SYSTEM (preserved exactly + floating bar integration)
     ============================================================ */

  async function startCall(type) {
    try {
      if (members.size > MAX_ROOM_MEMBERS) {
        addSystemMessage("Group calls are limited to 4 users.");
        return;
      }

      if (members.size <= 1) {
        addSystemMessage("No other member is connected yet.");
        return;
      }

      const constraints = {
        audio: true,
        video: type === "video"
      };

      localStream = await navigator.mediaDevices.getUserMedia(constraints);

      groupCallActive = true;
      groupCallMediaType = type;
      groupCallStarterId = myPeerId;

      callConnectedPeers.clear();
      answeredIncomingPeers.clear();

      showCallUI(type === "video");
      addLocalVideo();
      connectToAllKnownMembers();

      sendToAll({
        type: "call-started",
        name: myName || "Someone",
        mediaType: type,
        starterId: myPeerId
      });

      setTimeout(() => {
        const callCount = callAllKnownMembers(type);

        if (callCount > 0) {
          addSystemMessage(
            type === "video"
              ? "Group video call started. Use the bottom controls to mute or end call."
              : "Group voice call started. Use the bottom controls to mute or end call."
          );
        } else {
          addSystemMessage("Group call started. Waiting for members to connect...");
        }
      }, 900);

      setTimeout(() => repairGroupCallMesh("starter-repair-1"), 2500);
      setTimeout(() => repairGroupCallMesh("starter-repair-2"), 5000);
    } catch (err) {
      console.error("Media error:", err);
      alert("Could not access microphone/camera. Make sure HTTPS is enabled and permission is allowed.");
      groupCallActive = false;
      endCallUI(false);
    }
  }

  function handleIncomingCall(call) {
    const callerName = call.metadata?.callerName || "Someone";
    const incomingMediaType = call.metadata?.mediaType || groupCallMediaType || "voice";
    const incomingStarterId = call.metadata?.starterId || call.metadata?.callFrom || call.peer || "";

    if (groupCallActive && localStream) {
      try {
        groupCallStarterId = groupCallStarterId || incomingStarterId;
        answeredIncomingPeers.add(call.peer);
        call.answer(localStream);
        setupMediaCall(call);

        addSystemMessage(
          (members.get(call.peer)?.name || callerName || "Member") +
            " connected to the group call."
        );
      } catch (error) {
        console.warn("Auto-answer group mesh call failed:", error);

        try {
          call.close();
        } catch (e) {}
      }

      return;
    }

    pendingCall = call;

    if (callerNameDisplay) {
      callerNameDisplay.textContent = callerName;
    }

    incomingCallModal?.classList.remove("hidden");
    playRingtoneSound();

    btnAcceptCall.onclick = async () => {
      incomingCallModal?.classList.add("hidden");

      try {
        const wantsVideo = incomingMediaType === "video";

        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantsVideo
        });

        groupCallActive = true;
        groupCallMediaType = incomingMediaType;
        groupCallStarterId = groupCallStarterId || incomingStarterId;

        answeredIncomingPeers.add(call.peer);
        call.answer(localStream);

        showCallUI(wantsVideo);
        addLocalVideo();
        setupMediaCall(call);

        addSystemMessage("Call accepted. Connecting you to the group...");
        pendingCall = null;

        connectToAllKnownMembers();

        setTimeout(() => repairGroupCallMesh("accepted-call-1"), 900);
        setTimeout(() => repairGroupCallMesh("accepted-call-2"), 2400);
        setTimeout(() => repairGroupCallMesh("accepted-call-3"), 4800);
      } catch (err) {
        console.error("Answer call error:", err);
        alert("Could not answer call. Check microphone/camera permission.");

        sendToAll({
          type: "call-declined",
          name: myName || "Someone"
        });

        sendToPeer(call.peer, {
          type: "call-declined",
          name: myName || "Someone"
        });

        try {
          call.close();
        } catch (e) {}
      }
    };

    btnDeclineCall.onclick = () => {
      sendToAll({
        type: "call-declined",
        name: myName || "Someone"
      });

      sendToPeer(call.peer, {
        type: "call-declined",
        name: myName || "Someone"
      });

      try {
        call.close();
      } catch (e) {}

      pendingCall = null;
      incomingCallModal?.classList.add("hidden");
      addSystemMessage("Call declined.");
    };
  }

  function setupMediaCall(call) {
    if (!call) return;

    if (activeCalls.has(call.peer)) {
      try {
        call.close();
      } catch (e) {}

      return;
    }

    activeCalls.set(call.peer, call);

    call.on("stream", (remoteStream) => {
      addRemoteVideo(call.peer, remoteStream);

      const caller = members.get(call.peer)?.name || "Member";

      if (!callConnectedPeers.has(call.peer)) {
        callConnectedPeers.add(call.peer);
        addSystemMessage(caller + " connected to the call.");
      }

      if (groupCallActive) {
        setTimeout(() => repairGroupCallMesh("stream-connected"), 900);
      }
    });

    call.on("close", () => {
      activeCalls.delete(call.peer);
      callConnectedPeers.delete(call.peer);
      answeredIncomingPeers.delete(call.peer);
      removeRemoteVideo(call.peer);

      if (activeCalls.size === 0 && groupCallActive) {
        addSystemMessage("Call ended.");
        endCallUI(false);
      }
    });

    call.on("error", (err) => {
      console.warn("Call error:", err);

      activeCalls.delete(call.peer);
      callConnectedPeers.delete(call.peer);
      answeredIncomingPeers.delete(call.peer);
      removeRemoteVideo(call.peer);

      if (activeCalls.size === 0) {
        addSystemMessage("Call could not connect or was ended.");
        endCallUI(false);
      }
    });
  }

  /* ============================================================
     FEATURE 14: CALL UI + FLOATING CALL CONTROLS BAR
     ============================================================ */

  function showCallUI(hasVideo) {
    document.body.classList.add("qpc-call-active");
    document.body.classList.toggle("qpc-video-call", Boolean(hasVideo));
    document.body.classList.toggle("qpc-voice-call", !hasVideo);

    videoGrid?.classList.remove("hidden");

    btnVoiceCall?.classList.add("hidden");
    btnVideoCall?.classList.add("hidden");
    btnMuteMic?.classList.remove("hidden");
    btnEndCall?.classList.remove("hidden");

    if (hasVideo) {
      btnMuteCam?.classList.remove("hidden");
    } else {
      btnMuteCam?.classList.add("hidden");
    }

    // Show floating call controls bar
    callControlsBar?.classList.remove("hidden");
    syncFloatingCallControls();
  }

  function addLocalVideo() {
    if (!videoGrid || !localStream) return;

    const old = videoGrid.querySelector('[data-peer-id="me"]');

    if (old) {
      old.remove();
    }

    const video = document.createElement("video");
    video.srcObject = localStream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("data-peer-id", "me");

    videoGrid.appendChild(video);
  }

  function addRemoteVideo(peerId, stream) {
    if (!videoGrid) return;

    const old = videoGrid.querySelector('[data-peer-id="' + peerId + '"]');

    if (old) {
      old.remove();
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("data-peer-id", peerId);

    videoGrid.appendChild(video);
  }

  function removeRemoteVideo(peerId) {
    if (!videoGrid) return;

    const video = videoGrid.querySelector('[data-peer-id="' + peerId + '"]');

    if (video) {
      video.remove();
    }
  }

  function endCall(sendNotice = true, showLocalMessage = true) {
    groupCallActive = false;
    groupCallMediaType = "voice";
    groupCallStarterId = "";

    callConnectedPeers.clear();
    answeredIncomingPeers.clear();

    if (sendNotice) {
      sendToAll({
        type: "call-ended",
        name: myName || "Someone"
      });
    }

    activeCalls.forEach((call) => {
      try {
        call.close();
      } catch (e) {}
    });

    activeCalls.clear();

    if (showLocalMessage) {
      addSystemMessage("Call ended.");
    }

    endCallUI(false);
  }

  function endCallUI(showMessage = false) {
    document.body.classList.remove("qpc-call-active", "qpc-video-call", "qpc-voice-call");
    answeredIncomingPeers.clear();

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }

    if (videoGrid) {
      videoGrid.innerHTML = "";
      videoGrid.classList.add("hidden");
    }

    btnMuteMic?.classList.add("hidden");
    btnMuteCam?.classList.add("hidden");
    btnEndCall?.classList.add("hidden");
    btnVoiceCall?.classList.remove("hidden");
    btnVideoCall?.classList.remove("hidden");

    isMicMuted = false;
    isCamOff = false;

    if (btnMuteMic) {
      btnMuteMic.innerHTML = '<i class="fa-solid fa-microphone" aria-hidden="true"></i>';
    }

    if (btnMuteCam) {
      btnMuteCam.innerHTML = '<i class="fa-solid fa-video" aria-hidden="true"></i>';
    }

    // Hide floating call controls bar
    callControlsBar?.classList.add("hidden");
    syncFloatingCallControls();

    if (showMessage) {
      addSystemMessage("Call ended.");
    }
  }

  function toggleMic() {
    if (!localStream) return;

    const track = localStream.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    isMicMuted = !track.enabled;

    if (btnMuteMic) {
      btnMuteMic.innerHTML = isMicMuted
        ? '<i class="fa-solid fa-microphone-slash" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-microphone" aria-hidden="true"></i>';
    }

    syncFloatingCallControls();
  }

  function toggleCam() {
    if (!localStream) return;

    const track = localStream.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    isCamOff = !track.enabled;

    if (btnMuteCam) {
      btnMuteCam.innerHTML = isCamOff
        ? '<i class="fa-solid fa-video-slash" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-video" aria-hidden="true"></i>';
    }

    syncFloatingCallControls();
  }

  function syncFloatingCallControls() {
    if (ctrlMuteMic) {
      ctrlMuteMic.innerHTML = isMicMuted
        ? '<i class="fa-solid fa-microphone-slash" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-microphone" aria-hidden="true"></i>';
    }

    if (ctrlMuteCam) {
      ctrlMuteCam.innerHTML = isCamOff
        ? '<i class="fa-solid fa-video-slash" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-video" aria-hidden="true"></i>';
    }

    if (ctrlEndCall) {
      ctrlEndCall.innerHTML = '<i class="fa-solid fa-phone-slash" aria-hidden="true"></i>';
    }
  }

  function initFloatingCallControls() {
    ctrlMuteMic?.addEventListener("click", toggleMic);
    ctrlMuteCam?.addEventListener("click", toggleCam);
    ctrlEndCall?.addEventListener("click", () => endCall(true, true));
  }

  /* ============================================================
     FEATURE 9: SEARCH MESSAGES
     ============================================================ */

  function openSearch() {
    searchBar?.classList.remove("hidden");
    searchInput?.focus();
    searchActive = true;
  }

  function closeSearch() {
    searchBar?.classList.add("hidden");
    searchActive = false;

    if (searchInput) searchInput.value = "";

    // Restore all messages
    if (messagesContainer) {
      const allMessages = messagesContainer.querySelectorAll(".message-bubble, .system-msg");
      allMessages.forEach((el) => {
        el.classList.remove("search-hidden");
      });

      // Remove all mark tags
      const marks = messagesContainer.querySelectorAll("mark");
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent), mark);
          parent.normalize();
        }
      });
    }
  }

  function performSearch(query) {
    if (!messagesContainer || !query) {
      // Show all if query is empty
      if (messagesContainer) {
        const allMessages = messagesContainer.querySelectorAll(".message-bubble, .system-msg");
        allMessages.forEach((el) => el.classList.remove("search-hidden"));

        // Remove existing marks
        const marks = messagesContainer.querySelectorAll("mark");
        marks.forEach((mark) => {
          const parent = mark.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
          }
        });
      }
      return;
    }

    const lowerQuery = query.toLowerCase();
    const allMessages = messagesContainer.querySelectorAll(".message-bubble, .system-msg");

    allMessages.forEach((el) => {
      // First remove old marks
      const existingMarks = el.querySelectorAll("mark");
      existingMarks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent), mark);
          parent.normalize();
        }
      });

      const textContent = el.textContent.toLowerCase();

      if (textContent.includes(lowerQuery)) {
        el.classList.remove("search-hidden");
        highlightText(el, query);
      } else {
        el.classList.add("search-hidden");
      }
    });
  }

  function highlightText(element, query) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    const lowerQuery = query.toLowerCase();

    textNodes.forEach((node) => {
      const text = node.textContent;
      const lowerText = text.toLowerCase();
      const idx = lowerText.indexOf(lowerQuery);

      if (idx === -1) return;
      // Skip nodes inside msg-time or msg-ticks
      if (node.parentNode && (
        node.parentNode.classList?.contains("msg-time") ||
        node.parentNode.classList?.contains("msg-ticks") ||
        node.parentNode.classList?.contains("msg-meta") ||
        node.parentNode.tagName === "STRONG"
      )) return;

      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + query.length);
      const after = text.slice(idx + query.length);

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));

      const mark = document.createElement("mark");
      mark.textContent = match;
      frag.appendChild(mark);

      if (after) frag.appendChild(document.createTextNode(after));

      node.parentNode.replaceChild(frag, node);
    });
  }

  function initSearch() {
    btnSearch?.addEventListener("click", () => {
      if (searchActive) {
        closeSearch();
      } else {
        openSearch();
      }
    });

    btnCloseSearch?.addEventListener("click", closeSearch);

    searchInput?.addEventListener("input", () => {
      performSearch(searchInput.value.trim());
    });
  }

  /* ============================================================
     FEATURE 10: KEYBOARD SHORTCUTS
     ============================================================ */

  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ctrl+F in chat screen — open search
      if (e.ctrlKey && e.key === "f" && chatScreen?.classList.contains("active")) {
        e.preventDefault();
        openSearch();
        return;
      }

      // Escape — close search
      if (e.key === "Escape" && searchActive) {
        closeSearch();
        return;
      }

      // Call shortcuts (only when in call)
      if (e.ctrlKey && e.shiftKey) {
        if (e.key === "M" || e.key === "m") {
          if (groupCallActive && localStream) {
            e.preventDefault();
            toggleMic();
          }
          return;
        }

        if (e.key === "V" || e.key === "v") {
          if (groupCallActive && localStream) {
            e.preventDefault();
            toggleCam();
          }
          return;
        }

        if (e.key === "E" || e.key === "e") {
          if (groupCallActive) {
            e.preventDefault();
            endCall(true, true);
          }
          return;
        }
      }
    });
  }

  /* ============================================================
     FEATURE 12: ATTACH BUTTON FEEDBACK
     ============================================================ */

  function initAttachButton() {
    const attachBtn = $(".attach-btn");
    attachBtn?.addEventListener("click", () => {
      addSystemMessage("File sharing is disabled in this experimental version.");
    });
  }

  /* ============================================================
     FEATURE 13: LONG-PRESS COPY / RIGHT-CLICK CONTEXT MENU
     ============================================================ */

  function showContextMenu(x, y, text) {
    contextMenuTargetText = text;
    if (!messageContextMenu) return;

    messageContextMenu.classList.remove("hidden");
    messageContextMenu.style.position = "fixed";
    messageContextMenu.style.zIndex = "9999";

    // Position near click/touch
    const menuW = 160;
    const menuH = 48;
    let px = x;
    let py = y;

    if (px + menuW > window.innerWidth) px = window.innerWidth - menuW - 8;
    if (py + menuH > window.innerHeight) py = window.innerHeight - menuH - 8;
    if (px < 8) px = 8;
    if (py < 8) py = 8;

    messageContextMenu.style.left = px + "px";
    messageContextMenu.style.top = py + "px";
  }

  function hideContextMenu() {
    messageContextMenu?.classList.add("hidden");
    contextMenuTargetText = "";
  }

  function getMessageTextFromBubble(bubble) {
    const textEl = bubble.querySelector(".msg-text");
    if (textEl) return textEl.textContent || "";
    // fallback for system messages
    const sysContent = bubble.querySelector(".sys-content");
    if (sysContent) return sysContent.textContent || "";
    return bubble.textContent || "";
  }

  function initLongPressCopy() {
    // Touch events for mobile
    document.addEventListener("touchstart", (e) => {
      const bubble = e.target.closest(".message-bubble");
      if (!bubble) return;

      const touch = e.touches[0];
      longPressTouchStart = { x: touch.clientX, y: touch.clientY };

      longPressTimer = setTimeout(() => {
        const text = getMessageTextFromBubble(bubble);
        showContextMenu(longPressTouchStart.x, longPressTouchStart.y - 40, text);
        longPressTimer = null;
      }, 600);
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!longPressTimer || !longPressTouchStart) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - longPressTouchStart.x);
      const dy = Math.abs(touch.clientY - longPressTouchStart.y);

      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });

    document.addEventListener("touchend", () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });

    // Right-click on PC
    document.addEventListener("contextmenu", (e) => {
      const bubble = e.target.closest(".message-bubble");
      if (!bubble) return;

      e.preventDefault();
      const text = getMessageTextFromBubble(bubble);
      showContextMenu(e.clientX, e.clientY, text);
    });

    // Copy button in context menu
    btnContextCopy?.addEventListener("click", async () => {
      if (contextMenuTargetText) {
        try {
          await navigator.clipboard.writeText(contextMenuTargetText);
          addSystemMessage("Message copied to clipboard.");
        } catch (err) {
          // Fallback
          try {
            const textarea = document.createElement("textarea");
            textarea.value = contextMenuTargetText;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            addSystemMessage("Message copied to clipboard.");
          } catch (e2) {
            addSystemMessage("Could not copy message.");
          }
        }
      }
      hideContextMenu();
    });

    // Click anywhere else hides context menu
    document.addEventListener("click", (e) => {
      if (messageContextMenu && !messageContextMenu.contains(e.target)) {
        hideContextMenu();
      }
    });
  }

  /* ============================================================
     FEATURE 15: EMOJI CATEGORY TABS + RECENT EMOJIS
     ============================================================ */

  function initEmojiCategoryTabs() {
    const emojiPicker = $("#emoji-picker");
    if (!emojiPicker) return;

    const catTabs = emojiPicker.querySelectorAll("[data-emoji-cat]");
    const emojiButtons = emojiPicker.querySelectorAll("button[data-category]");

    if (catTabs.length === 0) return;

    catTabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.stopPropagation();
        const cat = tab.getAttribute("data-emoji-cat");

        // Update active state
        catTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        if (cat === "all") {
          emojiButtons.forEach((btn) => {
            btn.style.display = "";
          });
          return;
        }

        if (cat === "recent") {
          showRecentEmojis(emojiButtons);
          return;
        }

        emojiButtons.forEach((btn) => {
          const btnCat = btn.getAttribute("data-category");
          if (btnCat === cat) {
            btn.style.display = "";
          } else {
            btn.style.display = "none";
          }
        });
      });
    });

    // Track recent emojis on click
    emojiPicker.addEventListener("click", (e) => {
      const button = e.target.closest("button[data-category]");
      if (!button) return;
      const emoji = button.textContent?.trim();
      if (emoji) {
        saveRecentEmoji(emoji);
      }
    });
  }

  function saveRecentEmoji(emoji) {
    try {
      let recent = JSON.parse(localStorage.getItem("qpc_recent_emojis") || "[]");
      if (!Array.isArray(recent)) recent = [];

      recent = recent.filter((e) => e !== emoji);
      recent.unshift(emoji);
      recent = recent.slice(0, 10);

      localStorage.setItem("qpc_recent_emojis", JSON.stringify(recent));
    } catch (e) {}
  }

  function showRecentEmojis(emojiButtons) {
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem("qpc_recent_emojis") || "[]");
      if (!Array.isArray(recent)) recent = [];
    } catch (e) {}

    const recentSet = new Set(recent);

    emojiButtons.forEach((btn) => {
      const emoji = btn.textContent?.trim();
      if (recentSet.has(emoji)) {
        btn.style.display = "";
      } else {
        btn.style.display = "none";
      }
    });
  }

  /* ============================================================
     INPUT INITIALIZATION (preserved + typing input)
     ============================================================ */

  function initInputs() {
    if (roomCodeInput) {
      roomCodeInput.addEventListener("input", () => {
        roomCodeInput.value = roomCodeInput.value
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(0, 8);
      });
    }

    if (maxMembersInput) {
      maxMembersInput.setAttribute("max", String(MAX_ROOM_MEMBERS));
      maxMembersInput.value = String(
        Math.min(MAX_ROOM_MEMBERS, Number(maxMembersInput.value || MAX_ROOM_MEMBERS))
      );

      maxMembersInput.addEventListener("input", () => {
        const value = getSelectedMaxMembers();
        maxMembersInput.value = String(value);
      });
    }

    if (guestNameInput) {
      try {
        const savedName = localStorage.getItem("qpc_last_name");

        if (savedName && !guestNameInput.value) {
          guestNameInput.value = savedName;
        }
      } catch (e) {}

      guestNameInput.addEventListener("input", () => {
        guestNameInput.value = guestNameInput.value.replace(/[<>]/g, "").slice(0, 20);
      });
    }

    // Typing indicator input listener
    messageInput?.addEventListener("input", handleTypingInput);
  }

  function initInviteFromUrl() {
    const params = new URLSearchParams(window.location.search);

    const inviteRoom = String(params.get("room") || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8);

    if (!inviteRoom) return;

    if (roomCodeInput) {
      roomCodeInput.value = inviteRoom;
    }

    const joinTab = $("#tab-join");

    if (joinTab) {
      joinTab.click();
    }

    setEntryStatus(
      "Invite link detected. Enter your name, date of birth, accept terms, then join.",
      "success"
    );
  }

  async function copyRoomCode() {
    const code = displayRoomCode?.textContent?.trim();

    if (!code || code === "----") return;

    try {
      await navigator.clipboard.writeText(code);
      addSystemMessage("Room code copied.");
    } catch (e) {
      prompt("Copy room code:", code);
    }
  }

  async function copyInviteLink() {
    const code = displayRoomCode?.textContent?.trim();

    if (!code || code === "----") return;

    const inviteUrl = new URL(window.location.href);
    inviteUrl.searchParams.set("room", code);

    try {
      await navigator.clipboard.writeText(inviteUrl.toString());
      addSystemMessage("Invite link copied. Share it only with people you know.");
    } catch (e) {
      prompt("Copy invite link:", inviteUrl.toString());
    }
  }

  /* ============================================================
     EVENT BINDING (preserved + new features)
     ============================================================ */

  function bindEvents() {
    btnCreate?.addEventListener("click", hostRoom);
    btnJoin?.addEventListener("click", joinRoom);
    btnLeave?.addEventListener("click", leaveRoom);
    btnSend?.addEventListener("click", sendMessage);

    messageInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    btnMenu?.addEventListener("click", () => {
      sidebar?.classList.add("active");
    });

    btnCloseSidebar?.addEventListener("click", () => {
      sidebar?.classList.remove("active");
    });

    document.addEventListener("click", (event) => {
      if (!sidebar || !sidebar.classList.contains("active")) return;

      const clickedInsideSidebar = sidebar.contains(event.target);
      const clickedMenu = btnMenu && btnMenu.contains(event.target);

      if (!clickedInsideSidebar && !clickedMenu && window.innerWidth <= 840) {
        sidebar.classList.remove("active");
      }
    });

    copyCodeBtn?.addEventListener("click", copyRoomCode);
    copyInviteBtn?.addEventListener("click", copyInviteLink);

    btnVoiceCall?.addEventListener("click", () => startCall("voice"));
    btnVideoCall?.addEventListener("click", () => startCall("video"));
    btnMuteMic?.addEventListener("click", toggleMic);
    btnMuteCam?.addEventListener("click", toggleCam);
    btnEndCall?.addEventListener("click", () => endCall(true, true));

    window.addEventListener("beforeunload", () => {
      try {
        isUserLeaving = true;

        if (isHost) {
          sendRoomClosedToAll();
        } else {
          sendToAll({
            type: "member-left",
            id: myPeerId
          });
        }

        sendToAll({
          type: "call-ended",
          name: myName || "Someone"
        });
      } catch (e) {}
    });
  }

  /* ============================================================
     INITIALIZATION
     ============================================================ */

  function init() {
    initInputs();
    initInviteFromUrl();
    bindEvents();
    initScrollToBottom();
    initSearch();
    initKeyboardShortcuts();
    initAttachButton();
    initLongPressCopy();
    initFloatingCallControls();
    initEmojiCategoryTabs();
    initVisibilityChange();
    setConnectionStatus("Ready", "ready");

    console.log("[QPC] app.js v8.0.0 loaded. Max 4 users. PeerJS-only mode ready. 15 new features active.");
  }

  init();
})();
