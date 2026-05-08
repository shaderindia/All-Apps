/* ============================================================
   app.js  —  P2P Chat + WebRTC Calls (PeerJS only, no Supabase)
   ============================================================ */
(function () {
  "use strict";

  // ---------- DOM references ----------
  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);

  const entryScreen = $("#entry-screen");
  const chatScreen = $("#chat-screen");
  const sidebar = $("#sidebar");
  const messagesContainer = $("#messages-container");
  const messageInput = $("#message-input");
  const btnSend = $("#btn-send");
  const btnCreate = $("#btn-create");
  const btnJoin = $("#btn-join");
  const btnLeave = $("#btn-leave");
  const displayRoomCode = $("#display-room-code");
  const memberCount = $("#member-count");
  const membersList = $("#members-list");
  const myRoleBadge = $("#my-role-badge");
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
  const entryStatus = $("#entry-status");

  // ---------- State ----------
  let peer;
  let myPeerId = null;
  let myName = "";
  let isHost = false;
  let roomMembers = new Map();            // peerId -> { name, role, conn }
  let localStream = null;
  let currentCallPeers = new Set();       // active media calls
  let isMicMuted = false;
  let isCamOff = false;
  let pendingIncomingCall = null;         // MediaConnection awaiting answer

  // ---------- Utilities ----------
  function sanitize(str) {
    return String(str || "").replace(/[<>]/g, "").trim().slice(0, 50);
  }

  function setEntryStatus(msg, type = "error") {
    if (!entryStatus) return;
    entryStatus.textContent = msg || "";
    entryStatus.style.color =
      type === "success" ? "var(--success-color)" :
      type === "warning" ? "var(--warning-color)" :
      "var(--danger-color)";
  }

  function addSystemMessage(text) {
    const wrap = document.createElement("div");
    wrap.className = "system-msg";
    const content = document.createElement("div");
    content.className = "sys-content";
    content.textContent = text;
    messagesContainer.appendChild(wrap);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addMessage(sender, content, isOwn) {
    const msg = document.createElement("div");
    msg.style.alignSelf = isOwn ? "flex-end" : "flex-start";
    msg.style.maxWidth = "min(76%, 620px)";
    msg.style.padding = "12px 14px";
    msg.style.marginBottom = "10px";
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
    msg.innerHTML = `<strong style="font-size:11px;opacity:0.86;display:block;margin-bottom:4px;">${sanitize(sender)}</strong><span>${sanitize(content)}</span>`;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function updateMemberUI() {
    membersList.innerHTML = "";
    roomMembers.forEach((info, pid) => {
      const li = document.createElement("li");
      li.textContent = `${info.name} — ${info.role}`;
      li.setAttribute("data-peer-id", pid);
      membersList.appendChild(li);
    });
    memberCount.textContent = roomMembers.size;
  }

  function connectToPeer(peerId) {
    if (peerId === myPeerId || roomMembers.has(peerId)) return;
    const conn = peer.connect(peerId, { reliable: true });
    conn.on("open", () => {
      const prev = roomMembers.get(peerId) || {};
      roomMembers.set(peerId, { name: prev.name || "Unknown", role: prev.role || "Member", conn });
      conn.send({ type: "member-info", name: myName, role: isHost ? "Host" : "Member" });
      conn.on("data", data => handleDataMessage(peerId, data));
      conn.on("close", () => removeMember(peerId));
      conn.on("error", err => {
        console.warn("DataConnection error:", err);
        removeMember(peerId);
      });
    });
    conn.on("error", err => console.warn("Connection attempt error:", err));
  }

  function handleDataMessage(senderId, data) {
    // Data can be: { type: "member-info", name, role }
    // { type: "member-list", members: [{ id, name, role }] }
    // { type: "new-member", id, name, role }
    // { type: "member-left", id }
    // { type: "message", name, text }
    switch (data.type) {
      case "member-info":
        // Introduced by host/another peer
        roomMembers.set(senderId, { name: data.name, role: data.role, conn: roomMembers.get(senderId)?.conn || null });
        updateMemberUI();
        addSystemMessage(`${data.name} joined the room.`);
        // Also store the connection object (we may not have it yet, we'll assign in connectToPeer)
        break;

      case "member-list":
        // Full list received, connect to everyone we don't know
        data.members.forEach(m => {
          if (m.id !== myPeerId && !roomMembers.has(m.id)) {
            connectToPeer(m.id);
            roomMembers.set(m.id, { name: m.name, role: m.role, conn: null }); // conn will be set later
          }
        });
        updateMemberUI();
        break;

      case "new-member":
        if (data.id !== myPeerId && !roomMembers.has(data.id)) {
          connectToPeer(data.id);
          roomMembers.set(data.id, { name: data.name, role: data.role, conn: null });
          updateMemberUI();
          addSystemMessage(`${data.name} joined the room.`);
        }
        break;

      case "member-left":
        removeMember(data.id);
        break;

      case "message":
        addMessage(data.name, data.text, false);
        break;

      default:
        break;
    }
  }

  function removeMember(peerId) {
    if (roomMembers.has(peerId)) {
      const info = roomMembers.get(peerId);
      if (info.conn) info.conn.close();
      roomMembers.delete(peerId);
      updateMemberUI();
      addSystemMessage(`${info.name || "Someone"} left the room.`);
    }
  }


  function sendToAll(data) {
    roomMembers.forEach((info, pid) => {
      if (info.conn && info.conn.open) {
        info.conn.send(data);
      }
    });
  }

  // ---------- Room management ----------
  function enterRoom(peerIdHost, role) {
    const name = sanitize($("#guest-name-input").value || "User");
    myName = name;
    isHost = (role === "Host");
    displayRoomCode.textContent = peerIdHost; // host's peer ID is the code
    myRoleBadge.textContent = role;
    document.getElementById("my-name").textContent = myName;
    document.getElementById("my-avatar").textContent = myName.charAt(0).toUpperCase();

    // Add self to members
    roomMembers.set(myPeerId, { name: myName, role: role, conn: null });
    updateMemberUI();

    if (isHost) {
      // Host just waits for incoming connections
      addSystemMessage("Room created. Share this code with others.");
    } else {
      // Join: connect to host
      connectToPeer(peerIdHost);
      // Host will send us the full member list, then we'll connect to others.
    }

    entryScreen.classList.remove("active");
    chatScreen.classList.add("active");
    sidebar.classList.remove("active");
    try {
      localStorage.setItem("qpc_last_name", myName);
      localStorage.setItem("qpc_last_room", peerIdHost);
    } catch(e) {}
  }

  function leaveRoom() {
    // End all calls
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    currentCallPeers.forEach(call => call.close());
    currentCallPeers.clear();
    hideCallButtons();
    videoGrid.classList.add("hidden");
    videoGrid.innerHTML = "";

    // Notify others we're leaving
    sendToAll({ type: "member-left", id: myPeerId });

    // Close all connections
    roomMembers.forEach((info, pid) => {
      if (info.conn) info.conn.close();
    });
    roomMembers.clear();

    chatScreen.classList.remove("active");
    entryScreen.classList.add("active");
    sidebar.classList.remove("active");
    setEntryStatus("");
  }

  // ---------- Calls ----------
  function hideCallButtons() {
    btnMuteMic.classList.add("hidden");
    btnMuteCam.classList.add("hidden");
    btnEndCall.classList.add("hidden");
    btnVoiceCall.classList.remove("hidden");
    btnVideoCall.classList.remove("hidden");
  }

  function showCallButtons() {
    btnMuteMic.classList.remove("hidden");
    btnMuteCam.classList.remove("hidden");
    btnEndCall.classList.remove("hidden");
    btnVoiceCall.classList.add("hidden");
    btnVideoCall.classList.add("hidden");
  }

  async function startCall(mediaType) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mediaType === "video" });
      showCallButtons();
      videoGrid.classList.remove("hidden");

      // Add local video
      const localVideo = document.createElement("video");
      localVideo.muted = true;
      localVideo.srcObject = localStream;
      localVideo.autoplay = true;
      localVideo.playsInline = true;
      localVideo.setAttribute("data-peer-id", "me");
      videoGrid.appendChild(localVideo);

      // Call everyone
      roomMembers.forEach((info, pid) => {
        if (pid === myPeerId) return;
        const call = peer.call(pid, localStream, { metadata: { callerName: myName, mediaType } });
        currentCallPeers.add(call);
        call.on("stream", remoteStream => addRemoteStream(pid, remoteStream));
        call.on("close", () => {
          currentCallPeers.delete(call);
          removeRemoteStream(pid);
        });
        call.on("error", err => {
          console.warn("Call error:", err);
          currentCallPeers.delete(call);
        });
      });
    } catch (err) {
      console.error("getUserMedia error:", err);
      alert("Could not access microphone/camera.");
    }
  }


  function addRemoteStream(peerId, stream) {
    const existing = videoGrid.querySelector(`[data-peer-id="${peerId}"]`);
    if (existing) return;
    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("data-peer-id", peerId);
    videoGrid.appendChild(video);
  }

  function removeRemoteStream(peerId) {
    const video = videoGrid.querySelector(`[data-peer-id="${peerId}"]`);
    if (video) video.remove();
  }

  function endCallUI() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    hideCallButtons();
    videoGrid.classList.add("hidden");
    videoGrid.innerHTML = "";
  }

  // ---------- Init PeerJS ----------
  peer = new Peer(undefined, { debug: 1 });

  peer.on("open", id => {
    myPeerId = id;
    window.__qpcCoreReady = true;  // tell inline script that we're alive
  });


  peer.on("connection", conn => {
    conn.on("open", () => {
      roomMembers.set(conn.peer, { name: "Unknown", role: "Member", conn });
      conn.send({ type: "member-info", name: myName, role: isHost ? "Host" : "Member" });
      conn.on("data", data => handleDataMessage(conn.peer, data));
      conn.on("close", () => removeMember(conn.peer));
      conn.on("error", () => removeMember(conn.peer));
    });
  });

  peer.on("call", call => {
    const callerName = call.metadata?.callerName || "Someone";
    callerNameDisplay.textContent = callerName;
    incomingCallModal.classList.remove("hidden");

    btnAcceptCall.onclick = async () => {
      incomingCallModal.classList.add("hidden");
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.metadata?.mediaType === "video" });
        call.answer(localStream);
        currentCallPeers.add(call);
        showCallButtons();
        videoGrid.classList.remove("hidden");

        const localVideo = document.createElement("video");
        localVideo.muted = true;
        localVideo.srcObject = localStream;
        localVideo.autoplay = true;
        localVideo.playsInline = true;
        localVideo.setAttribute("data-peer-id", "me");
        videoGrid.appendChild(localVideo);

        call.on("stream", remoteStream => addRemoteStream(call.peer, remoteStream));
        call.on("close", () => {
          currentCallPeers.delete(call);
          removeRemoteStream(call.peer);
          if (currentCallPeers.size === 0) endCallUI();
        });
        call.on("error", () => currentCallPeers.delete(call));
      } catch (err) {
        alert("Could not answer call.");
        incomingCallModal.classList.add("hidden");
      }
    };

    btnDeclineCall.onclick = () => {
      call.close();
      incomingCallModal.classList.add("hidden");
    };
  });
  peer.on("error", err => {
    console.error("PeerJS error:", err);
    if (entryScreen.classList.contains("active")) {
      setEntryStatus("Connection error. Check network.", "error");
    }
  });

  // ---------- Override button handlers (remove inline script listeners) ----------
  function replaceButtonListeners() {
    // Replace Create button
    const newCreateBtn = btnCreate.cloneNode(true);
    btnCreate.parentNode.replaceChild(newCreateBtn, btnCreate);
    newCreateBtn.addEventListener("click", () => {
      const name = sanitize($("#guest-name-input").value);
      const dob = $("#dob-input").value;
      const age = getAgeFromDob(dob);
      if (!name || age === null || age < 19) return;
      if (!myPeerId) {
        setEntryStatus("Waiting for connection...", "warning");
        return;
      }
      enterRoom(myPeerId, "Host");  // room code = host's own peer ID
    });

    // Replace Join button
    const newJoinBtn = btnJoin.cloneNode(true);
    btnJoin.parentNode.replaceChild(newJoinBtn, btnJoin);
    newJoinBtn.addEventListener("click", () => {
      const name = sanitize($("#guest-name-input").value);
      const dob = $("#dob-input").value;
      const age = getAgeFromDob(dob);
      const roomCode = $("#room-code-input").value.trim();
      if (!name || age === null || age < 19 || !roomCode) return;
      if (!myPeerId) {
        setEntryStatus("Waiting for connection...", "warning");
        return;
      }
      enterRoom(roomCode, "Member");
    });

    // Send button
    btnSend.addEventListener("click", () => {
      const text = messageInput.value.trim();
      if (text) {
        addMessage(myName, text, true);
        sendToAll({ type: "message", name: myName, text });
        messageInput.value = "";
      }
    });

    messageInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        btnSend.click();
      }
    });

    btnLeave.addEventListener("click", leaveRoom);

    btnVoiceCall.addEventListener("click", () => startCall("voice"));
    btnVideoCall.addEventListener("click", () => startCall("video"));

    btnMuteMic.addEventListener("click", () => {
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled;
          isMicMuted = !audioTrack.enabled;
          btnMuteMic.innerHTML = isMicMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
        }
      }
    });

    btnMuteCam.addEventListener("click", () => {
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          isCamOff = !videoTrack.enabled;
          btnMuteCam.innerHTML = isCamOff ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>';
        }
      }
    });

    btnEndCall.addEventListener("click", () => {
      // Close all outgoing calls
      currentCallPeers.forEach(call => call.close());
      currentCallPeers.clear();
      endCallUI();
    });

    // Sidebar toggles (already in inline, but safe)
    document.getElementById("btn-menu")?.addEventListener("click", () => sidebar.classList.add("active"));
    document.getElementById("btn-close-sidebar")?.addEventListener("click", () => sidebar.classList.remove("active"));
    document.getElementById("copy-code-btn")?.addEventListener("click", async () => {
      const code = displayRoomCode.textContent.trim();
      if (code && code !== "----") {
        try { await navigator.clipboard.writeText(code); addSystemMessage("Room code copied."); } catch { prompt("Copy room code:", code); }
      }
    });
  }

  // Age helper (copied from inline)
  function getAgeFromDob(dobVal) {
    if (!dobVal) return null;
    const bd = new Date(dobVal + "T00:00:00");
    if (isNaN(bd.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - bd.getFullYear();
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
    return age;
  }

  // Wait for PeerJS to be ready, then replace handlers
  const checkReady = setInterval(() => {
    if (myPeerId) {
      clearInterval(checkReady);
      replaceButtonListeners();
      // Fill saved name if any
      const savedName = localStorage.getItem("qpc_last_name");
      if (savedName && !$("#guest-name-input").value) $("#guest-name-input").value = savedName;
    }
  }, 200);
})();
