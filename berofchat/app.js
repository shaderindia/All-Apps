/* ============================================================
   app.js — QUICK PRIVATE CHAT by SHADER7
   PeerJS-only room-code chat + GROUP WebRTC calls

   Features:
   - Host creates short 6-character room code
   - Join by room code or invite link ?room=ABC123
   - Text chat over PeerJS DataConnection
   - Group voice/video calls using mesh PeerJS MediaConnections
   - Every member connects to every other member for group calls
   - Call rejected message shown to caller
   - Call ended message shown
   - No Supabase required
   ============================================================ */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const entryScreen = $("#entry-screen");
  const chatScreen = $("#chat-screen");
  const sidebar = $("#sidebar");

  const guestNameInput = $("#guest-name-input");
  const roomCodeInput = $("#room-code-input");
  const dobInput = $("#dob-input");
  const tosCheckbox = $("#tos-checkbox");

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

  let peer = null;
  let myPeerId = "";
  let roomCode = "";
  let myName = "";
  let isHost = false;

  const connections = new Map();
  const members = new Map();

  let localStream = null;
  const activeCalls = new Map();

  let pendingCall = null;
  let isMicMuted = false;
  let isCamOff = false;
  let lastMessageTime = 0;

  window.__qpcCoreReady = true;

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

    if (type === "success") {
      entryStatus.style.color = "var(--success-color)";
    } else if (type === "warning") {
      entryStatus.style.color = "var(--warning-color)";
    } else {
      entryStatus.style.color = "var(--danger-color)";
    }
  }

  function setConnectionStatus(text, state = "ready") {
    if (!connectionStatus) return;

    connectionStatus.classList.remove("connected", "offline");
    connectionStatus.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    connectionStatus.appendChild(document.createTextNode(" " + text));

    if (state === "connected") {
      connectionStatus.classList.add("connected");
    }

    if (state === "offline") {
      connectionStatus.classList.add("offline");
    }
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

  function validateEntry(requireRoomCode) {
    const name = sanitize(guestNameInput?.value, 20);
    const dob = dobInput?.value || "";
    const age = getAgeFromDob(dob);
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

  function addSystemMessage(text) {
    if (!messagesContainer) return;

    const wrap = document.createElement("div");
    wrap.className = "system-msg";

    const content = document.createElement("div");
    content.className = "sys-content";
    content.textContent = text;

    wrap.appendChild(content);
    messagesContainer.appendChild(wrap);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addChatMessage(sender, text, isOwn) {
    if (!messagesContainer) return;

    const msg = document.createElement("div");

    msg.style.alignSelf = isOwn ? "flex-end" : "flex-start";
    msg.style.maxWidth = "min(76%, 620px)";
    msg.style.padding = "12px 14px";
    msg.style.marginBottom = "10px";
    msg.style.wordBreak = "break-word";

    if (isOwn) {
      msg.style.borderRadius = "18px 18px 6px 18px";
      msg.style.background = "var(--grad-primary)";
      msg.style.color = "#fff";
      msg.style.boxShadow = "0 12px 24px rgba(0,168,255,0.16)";
    } else {
      msg.style.borderRadius = "18px 18px 18px 6px";
      msg.style.background = "rgba(255,255,255,0.92)";
      msg.style.color = "var(--text-main)";
      msg.style.boxShadow = "0 8px 18px rgba(15,23,42,0.08)";
    }

    const nameEl = document.createElement("strong");
    nameEl.style.fontSize = "11px";
    nameEl.style.opacity = "0.86";
    nameEl.style.display = "block";
    nameEl.style.marginBottom = "4px";
    nameEl.textContent = sender;

    const textEl = document.createElement("span");
    textEl.textContent = text;

    msg.appendChild(nameEl);
    msg.appendChild(textEl);

    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function updateMembersUI() {
    if (!membersList || !memberCount) return;

    membersList.innerHTML = "";

    members.forEach((info) => {
      const li = document.createElement("li");
      li.textContent = `${info.name} — ${info.role}`;
      membersList.appendChild(li);
    });

    memberCount.textContent = String(members.size);
  }

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
  }

  function createPeer(id) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === "undefined") {
        reject(new Error("PeerJS library did not load."));
        return;
      }

      const p = new Peer(id, {
        debug: 1
      });

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
        resolve({ peerInstance: p, id: openedId });
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

  function sendToAll(data) {
    connections.forEach((conn) => {
      if (conn && conn.open) {
        try {
          conn.send(data);
        } catch (e) {}
      }
    });
  }

  function sendToPeer(peerId, data) {
    const conn = connections.get(peerId);

    if (conn && conn.open) {
      try {
        conn.send(data);
      } catch (e) {}
    }
  }

  function sendMemberListTo(conn) {
    const list = Array.from(members.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      role: info.role
    }));

    conn.send({
      type: "member-list",
      members: list
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
      members: list
    });
  }

  function setupConnection(conn) {
    if (!conn) return;

    if (connections.has(conn.peer)) {
      const oldConn = connections.get(conn.peer);
      if (oldConn && oldConn.open) return;
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
      handleMemberLeft(conn.peer);
    });

    conn.on("error", (err) => {
      console.warn("Connection error:", err);
      handleMemberLeft(conn.peer);
    });
  }

  function handleData(senderId, data) {
    if (!data || typeof data !== "object") return;

    if (data.type === "hello") {
      const memberName = sanitize(data.name, 20) || "Unknown";

      members.set(senderId, {
        name: memberName,
        role: sanitize(data.role, 20) || "Member"
      });

      updateMembersUI();

      if (isHost) {
        addSystemMessage(`${memberName} joined the room.`);
        broadcastMemberList();
      }

      return;
    }

    if (data.type === "member-list") {
      members.clear();

      data.members.forEach((m) => {
        members.set(m.id, {
          name: sanitize(m.name, 20) || "Unknown",
          role: sanitize(m.role, 20) || "Member"
        });
      });

      updateMembersUI();
      connectToAllKnownMembers();
      return;
    }

    if (data.type === "message") {
      addChatMessage(data.name || "Someone", data.text || "", false);
      return;
    }

    if (data.type === "member-left") {
      handleMemberLeft(data.id);
      return;
    }

    if (data.type === "call-started") {
      addSystemMessage((data.name || "Someone") + " started a call.");
      return;
    }

    if (data.type === "call-declined") {
      const name = data.name || "The other user";
      addSystemMessage(name + " rejected the call.");
      endCallUI(false);
      return;
    }

    if (data.type === "call-ended") {
      addSystemMessage((data.name || "Someone") + " ended the call.");
      endCallUI(false);
      return;
    }
  }

  function connectToAllKnownMembers() {
    if (!peer || !myPeerId) return;

    members.forEach((info, peerId) => {
      if (!peerId || peerId === myPeerId) return;
      if (connections.has(peerId) && connections.get(peerId)?.open) return;

      try {
        const conn = peer.connect(peerId, { reliable: true });
        setupConnection(conn);
      } catch (error) {
        console.warn("Could not connect to member:", peerId, error);
      }
    });
  }

  function callAllKnownMembers(mediaType) {
    if (!peer || !localStream) return 0;

    let count = 0;

    members.forEach((info, peerId) => {
      if (!peerId || peerId === myPeerId) return;
      if (activeCalls.has(peerId)) return;

      try {
        const call = peer.call(peerId, localStream, {
          metadata: {
            callerName: myName,
            mediaType,
            groupCall: true
          }
        });

        setupMediaCall(call);
        count++;
      } catch (error) {
        console.warn("Could not call member:", peerId, error);
      }
    });

    return count;
  }

  function handleMemberLeft(peerId) {
    if (!peerId || peerId === myPeerId) return;

    const oldMember = members.get(peerId);

    connections.delete(peerId);
    members.delete(peerId);

    updateMembersUI();

    if (oldMember) {
      addSystemMessage(`${oldMember.name} left the room.`);
    }

    removeRemoteVideo(peerId);

    if (isHost) {
      broadcastMemberList();
    }
  }

  async function hostRoom() {
    if (!validateEntry(false)) return;

    destroyPeer();

    myName = sanitize(guestNameInput.value, 20);
    roomCode = generateRoomCode(6);
    isHost = true;

    setEntryStatus("Creating room...", "success");

    try {
      const result = await createPeer(roomCode);

      peer = result.peerInstance;
      myPeerId = result.id;

      peer.on("connection", setupConnection);
      peer.on("call", handleIncomingCall);

      members.set(myPeerId, {
        name: myName,
        role: "Host"
      });

      updateMembersUI();
      enterChatScreen("Host");
      addSystemMessage("Room created. Share this room code or invite link only with people you know: " + roomCode + ". Group calls work best with 2–6 people depending on device/network speed.");
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

    setEntryStatus("Joining room...", "success");

    try {
      const result = await createPeer(undefined);

      peer = result.peerInstance;
      myPeerId = result.id;

      peer.on("connection", setupConnection);
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
        addSystemMessage("Joined room " + roomCode + ". Remember: the room works only while the host is online. For group calls, keep this tab open.");
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

  function sendMessage() {
    const now = Date.now();

    if (now - lastMessageTime < 450) {
      addSystemMessage("Please wait a moment before sending another message.");
      return;
    }

    lastMessageTime = now;

    const text = sanitize(messageInput?.value, 1000);

    if (!text) return;

    addChatMessage(myName || "You", text, true);

    sendToAll({
      type: "message",
      name: myName || "Someone",
      text
    });

    messageInput.value = "";
  }

  function leaveRoom() {
    sendToAll({
      type: "member-left",
      id: myPeerId
    });

    endCall(false, false);
    destroyPeer();

    roomCode = "";
    myName = "";
    isHost = false;

    chatScreen?.classList.remove("active");
    entryScreen?.classList.add("active");
    sidebar?.classList.remove("active");

    setEntryStatus("");
  }

  async function startCall(type) {
    try {
      if (!connections.size) {
        addSystemMessage("No other member is connected yet.");
        return;
      }

      const constraints = {
        audio: true,
        video: type === "video"
      };

      localStream = await navigator.mediaDevices.getUserMedia(constraints);

      showCallUI(type === "video");
      addLocalVideo();

      sendToAll({
        type: "call-started",
        name: myName || "Someone",
        mediaType: type
      });

      connectToAllKnownMembers();

      setTimeout(() => {
        const callCount = callAllKnownMembers(type);

        if (callCount > 0) {
          addSystemMessage(type === "video" ? "Group video call started. Use the bottom controls to mute or end call." : "Group voice call started. Use the bottom controls to mute or end call.");
        } else {
          addSystemMessage("No reachable members found for the call yet. Ask members to stay online and try again.");
        }
      }, 700);
    } catch (err) {
      console.error("Media error:", err);
      alert("Could not access microphone/camera. Make sure HTTPS is enabled and permission is allowed.");
      endCallUI(false);
    }
  }

  function handleIncomingCall(call) {
    pendingCall = call;

    const callerName = call.metadata?.callerName || "Someone";

    if (callerNameDisplay) callerNameDisplay.textContent = callerName;
    incomingCallModal?.classList.remove("hidden");

    btnAcceptCall.onclick = async () => {
      incomingCallModal?.classList.add("hidden");

      try {
        const wantsVideo = call.metadata?.mediaType === "video";

        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantsVideo
        });

        call.answer(localStream);

        showCallUI(wantsVideo);
        addLocalVideo();
        setupMediaCall(call);

        addSystemMessage("Call accepted. Connecting you to the group...");
        pendingCall = null;

        setTimeout(() => {
          connectToAllKnownMembers();
          callAllKnownMembers(call.metadata?.mediaType || "voice");
        }, 700);
      } catch (err) {
        console.error("Answer call error:", err);
        alert("Could not answer call. Check microphone/camera permission.");

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

    activeCalls.set(call.peer, call);

    call.on("stream", (remoteStream) => {
      addRemoteVideo(call.peer, remoteStream);
      const caller = members.get(call.peer)?.name || "Member";
      addSystemMessage(caller + " connected to the call.");
    });

    call.on("close", () => {
      activeCalls.delete(call.peer);
      removeRemoteVideo(call.peer);

      if (activeCalls.size === 0) {
        addSystemMessage("Call ended.");
        endCallUI(false);
      }
    });

    call.on("error", (err) => {
      console.warn("Call error:", err);
      activeCalls.delete(call.peer);
      removeRemoteVideo(call.peer);

      if (activeCalls.size === 0) {
        addSystemMessage("Call could not connect or was ended.");
        endCallUI(false);
      }
    });
  }

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
  }

  function addLocalVideo() {
    if (!videoGrid || !localStream) return;

    const old = videoGrid.querySelector('[data-peer-id="me"]');
    if (old) old.remove();

    const video = document.createElement("video");
    video.srcObject = localStream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("data-peer-id", "me");
    video.style.width = "100%";
    video.style.minHeight = "160px";
    video.style.background = "#020617";
    video.style.borderRadius = "18px";
    video.style.objectFit = "cover";

    videoGrid.appendChild(video);
  }

  function addRemoteVideo(peerId, stream) {
    if (!videoGrid) return;

    const old = videoGrid.querySelector(`[data-peer-id="${peerId}"]`);
    if (old) old.remove();

    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("data-peer-id", peerId);
    video.style.width = "100%";
    video.style.minHeight = "160px";
    video.style.background = "#020617";
    video.style.borderRadius = "18px";
    video.style.objectFit = "cover";

    videoGrid.appendChild(video);
  }

  function removeRemoteVideo(peerId) {
    if (!videoGrid) return;

    const video = videoGrid.querySelector(`[data-peer-id="${peerId}"]`);
    if (video) video.remove();
  }

  function endCall(sendNotice = true, showLocalMessage = true) {
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

    if (btnMuteMic) btnMuteMic.innerHTML = '<i class="fa-solid fa-microphone" aria-hidden="true"></i>';
    if (btnMuteCam) btnMuteCam.innerHTML = '<i class="fa-solid fa-video" aria-hidden="true"></i>';

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
  }

  function initRoomCodeInput() {
    if (!roomCodeInput) return;

    roomCodeInput.addEventListener("input", () => {
      roomCodeInput.value = roomCodeInput.value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 8);
    });
  }

  function loadSavedName() {
    try {
      const savedName = localStorage.getItem("qpc_last_name");
      if (savedName && guestNameInput && !guestNameInput.value) {
        guestNameInput.value = savedName;
      }
    } catch (e) {}
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
    if (joinTab) joinTab.click();

    setEntryStatus("Invite link detected. Enter your name, date of birth, accept terms, then join.", "success");
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
        sendToAll({
          type: "member-left",
          id: myPeerId
        });

        sendToAll({
          type: "call-ended",
          name: myName || "Someone"
        });
      } catch (e) {}
    });
  }

  function init() {
    initRoomCodeInput();
    loadSavedName();
    initInviteFromUrl();
    bindEvents();
    setConnectionStatus("Ready", "ready");

    console.log("[QPC] app.js loaded. PeerJS-only mode ready.");
  }

  init();
})();
