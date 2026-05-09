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
   ============================================================ */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const MAX_ROOM_MEMBERS = 4;

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
    msg.className = isOwn ? "message-bubble own" : "message-bubble other";

    const nameEl = document.createElement("strong");
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

    members.forEach((info, peerId) => {
      const li = document.createElement("li");
      li.textContent = `${info.name} — ${info.role}`;
      li.setAttribute("data-peer-id", peerId);
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
      "room-closed"
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
    }, 800);
  }

  function setupConnection(conn) {
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
      handleMemberLeft(conn.peer);
    });

    conn.on("error", (err) => {
      console.warn("Connection error:", err);
      handleMemberLeft(conn.peer);
    });
  }

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

      updateMembersUI();

      if (isHost) {
        addSystemMessage(`${memberName} joined the room.`);
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
      });

      updateMembersUI();
      connectToAllKnownMembers();
      repairGroupCallMesh("member-list");
      return;
    }

    if (data.type === "message") {
      if (data.__originalSender && data.__originalSender === myPeerId) return;

      addChatMessage(data.name || "Someone", data.text || "", false);
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
      addSystemMessage(`${oldMember.name} left the room.`);
    }

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
    roomClosedByHost = false;
    roomMaxMembers = getSelectedMaxMembers();

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
  }

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

    const old = videoGrid.querySelector(`[data-peer-id="${peerId}"]`);

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

    const video = videoGrid.querySelector(`[data-peer-id="${peerId}"]`);

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

  function init() {
    initInputs();
    initInviteFromUrl();
    bindEvents();
    setConnectionStatus("Ready", "ready");

    console.log("[QPC] app.js loaded. Max 4 users. PeerJS-only mode ready.");
  }

  init();
})();
