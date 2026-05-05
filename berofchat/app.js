/* ============================================================
   app.js  —  Full P2P Chat + WebRTC Calls for QUICK PRIVATE CHAT
   Requires: supabase-config.js, PeerJS, Supabase SDK
   ============================================================ */
(function () {
  "use strict";

  /* ---------- CONFIG & GLOBAL REFS ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Check if Supabase config exists
  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
  const hasSupabase = SUPABASE_URL && SUPABASE_ANON_KEY;

  let supabase, peer;
  let myPeerId = null;          // PeerJS peer ID
  let myName = "";              // display name
  let currentRoomCode = null;
  let isHost = false;
  let currentCall = null;       // active media call
  let localStream = null;       // local media stream
  let isMicMuted = false;
  let isCamOff = false;
  const peerConnections = {};   // DataConnections: { peerId: conn }
  const remoteStreams = {};     // streams for video grid (by peerId)

  // DOM cache (many already exist in HTML)
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
  const btnReport = $("#btn-report");
  const reportModal = $("#report-modal");
  const btnCancelReport = $("#btn-cancel-report");
  const btnSubmitReport = $("#btn-submit-report");
  const entryStatus = $("#entry-status");

  /* ---------- UTILITIES ---------- */
  function setEntryStatus(msg, type = "error") {
    if (!entryStatus) return;
    entryStatus.textContent = msg || "";
    entryStatus.style.color =
      type === "success" ? "var(--success-color)" :
      type === "warning" ? "var(--warning-color)" :
      "var(--danger-color)";
  }

  function sanitize(str) {
    return String(str || "").replace(/[<>]/g, "").trim().slice(0, 50);
  }

  function addSystemMessage(text) {
    const wrap = document.createElement("div");
    wrap.className = "system-msg";
    const content = document.createElement("div");
    content.className = "sys-content";
    content.textContent = text;
    wrap.appendChild(content);
    messagesContainer.appendChild(wrap);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addMessage(sender, content, isOwn = false) {
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

  /* ---------- SUPABASE INIT ---------- */
  if (hasSupabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
  } else {
    console.warn("[QPC] Supabase not configured. Running in offline/local mode.");
  }

  /* ---------- PEERJS INIT ---------- */
  peer = new Peer(undefined, {
    debug: 1
  });

  peer.on("open", (id) => {
    myPeerId = id;
    window.__qpcCoreReady = true;   // signal to the inline script that core is ready
  });

  peer.on("error", (err) => {
    console.error("[QPC] PeerJS error:", err);
    if (entryScreen.classList.contains("active")) {
      setEntryStatus("Connection error. Check your network.", "error");
    }
  });

  /* ---------- DATA CONNECTION HANDLING (P2P messaging) ---------- */
  function connectToMember(destPeerId) {
    if (destPeerId === myPeerId || peerConnections[destPeerId]) return;
    const conn = peer.connect(destPeerId, { reliable: true });
    conn.on("open", () => {
      peerConnections[destPeerId] = conn;
    });
    conn.on("data", (data) => {
      if (typeof data === "object" && data.type === "message") {
        addMessage(data.name, data.text, false);
      }
    });
    conn.on("close", () => {
      delete peerConnections[destPeerId];
    });
    conn.on("error", (err) => {
      console.warn("DataConnection error:", err);
      delete peerConnections[destPeerId];
    });
  }

  // When a remote connection comes in
  peer.on("connection", (conn) => {
    conn.on("open", () => {
      peerConnections[conn.peer] = conn;
    });
    conn.on("data", (data) => {
      if (typeof data === "object" && data.type === "message") {
        addMessage(data.name, data.text, false);
      }
    });
    conn.on("close", () => {
      delete peerConnections[conn.peer];
    });
    conn.on("error", (err) => {
      console.warn("Incoming DataConnection error:", err);
      delete peerConnections[conn.peer];
    });
  });

  // Send a message: try P2P first, fallback to Supabase
  function sendMessage(text) {
    if (!text) return;
    // Show own message immediately
    addMessage(myName, text, true);

    // Try to send to all connected peers
    const data = { type: "message", name: myName, text };
    let sentP2P = false;
    for (const [destId, conn] of Object.entries(peerConnections)) {
      if (conn.open) {
        conn.send(data);
        sentP2P = true;
      }
    }

    // Fallback to Supabase if P2P didn't cover everyone
    if (!sentP2P && hasSupabase && currentRoomCode) {
      supabase.from("messages").insert({
        room_code: currentRoomCode,
        sender_peer_id: myPeerId,
        sender_name: myName,
        content: text
      }).then(({ error }) => {
        if (error) console.error("Message insert error:", error);
      });
    }
  }

  /* ---------- MEDIA CALLS ---------- */
  function endCall() {
    if (currentCall) {
      currentCall.close();
      currentCall = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    hideCallButtons();
    videoGrid.classList.add("hidden");
    videoGrid.innerHTML = "";
    incomingCallModal.classList.add("hidden");
  }

  function showCallButtons() {
    btnMuteMic.classList.remove("hidden");
    btnMuteCam.classList.remove("hidden");
    btnEndCall.classList.remove("hidden");
    btnVoiceCall.classList.add("hidden");
    btnVideoCall.classList.add("hidden");
  }

  function hideCallButtons() {
    btnMuteMic.classList.add("hidden");
    btnMuteCam.classList.add("hidden");
    btnEndCall.classList.add("hidden");
    btnVoiceCall.classList.remove("hidden");
    btnVideoCall.classList.remove("hidden");
  }

  async function startCall(mediaType = "voice") {
    if (!currentRoomCode) return;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mediaType === "video"
      });
      isMicMuted = false;
      isCamOff = false;
      showCallButtons();

      // Add local video to grid
      videoGrid.classList.remove("hidden");
      const localVideo = document.createElement("video");
      localVideo.muted = true;
      localVideo.srcObject = localStream;
      localVideo.autoplay = true;
      localVideo.playsInline = true;
      localVideo.setAttribute("data-peer-id", "me");
      videoGrid.appendChild(localVideo);

      // Call every other member in room
      const otherPeers = getOtherPeerIds();
      for (const destId of otherPeers) {
        const call = peer.call(destId, localStream, {
          metadata: { callerName: myName, mediaType }
        });
        handleOutgoingCall(call, destId);
      }

      // Also update my stream for any future immediate call
      currentCall = { close: () => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        localStream = null;
        hideCallButtons();
        videoGrid.innerHTML = "";
        videoGrid.classList.add("hidden");
      }};
    } catch (err) {
      console.error("getUserMedia error:", err);
      alert("Could not access microphone/camera. Check permissions.");
    }
  }

  function handleOutgoingCall(call, destId) {
    call.on("stream", (remoteStream) => {
      addRemoteStream(destId, remoteStream);
    });
    call.on("close", () => {
      removeRemoteStream(destId);
    });
    call.on("error", (err) => {
      console.warn("Call error:", err);
    });
  }

  // Answer incoming call
  peer.on("call", async (call) => {
    // Show incoming call modal
    const caller = call.metadata?.callerName || "Someone";
    callerNameDisplay.textContent = caller;
    incomingCallModal.classList.remove("hidden");

    btnAcceptCall.onclick = async () => {
      incomingCallModal.classList.add("hidden");
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.metadata?.mediaType === "video"
        });
        call.answer(localStream);
        currentCall = call;
        showCallButtons();
        videoGrid.classList.remove("hidden");
        // Show local video
        const localVideo = document.createElement("video");
        localVideo.muted = true;
        localVideo.srcObject = localStream;
        localVideo.autoplay = true;
        localVideo.playsInline = true;
        localVideo.setAttribute("data-peer-id", "me");
        videoGrid.appendChild(localVideo);

        call.on("stream", (remoteStream) => {
          addRemoteStream(call.peer, remoteStream);
        });
        call.on("close", endCall);
        call.on("error", (err) => {
          console.error("Incoming call error:", err);
          endCall();
        });
      } catch (err) {
        console.error("Answer error:", err);
        alert("Could not access media. Call failed.");
        incomingCallModal.classList.add("hidden");
      }
    };

    btnDeclineCall.onclick = () => {
      call.close();
      incomingCallModal.classList.add("hidden");
    };
  });

  function addRemoteStream(peerId, stream) {
    if (remoteStreams[peerId]) return;
    remoteStreams[peerId] = stream;
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
    const stream = remoteStreams[peerId];
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      delete remoteStreams[peerId];
    }
  }

  /* ---------- ROOM MANAGEMENT ---------- */
  function getOtherPeerIds() {
    const lis = membersList.querySelectorAll("li");
    const ids = [];
    for (const li of lis) {
      const peerId = li.getAttribute("data-peer-id");
      if (peerId && peerId !== myPeerId) ids.push(peerId);
    }
    return ids;
  }

  async function createRoom() {
    if (!hasSupabase) {
      // Offline fallback
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      enterRoomUI(code, "Host");
      return;
    }
    const maxMembers = parseInt($("#max-members-create").value) || 10;
    let code;
    while (true) {
      code = generateRoomCode();
      const { data } = await supabase.from("rooms").select("code").eq("code", code).single();
      if (!data) break;
    }
    const { error } = await supabase.from("rooms").insert({
      code,
      host_peer_id: myPeerId,
      max_members: maxMembers
    });
    if (error) {
      console.error("Room creation error:", error);
      setEntryStatus("Could not create room. Try again.", "error");
      return;
    }
    await addMember(code, myPeerId, myName, "Host");
    enterRoomUI(code, "Host");
  }

  async function joinRoom(code) {
    if (!hasSupabase) {
      enterRoomUI(code, "Member");
      return;
    }
    const { data: room } = await supabase.from("rooms").select("*").eq("code", code).single();
    if (!room) {
      setEntryStatus("Room not found.", "error");
      return;
    }
    const { count } = await supabase.from("members").select("*", { count: "exact" }).eq("room_code", code);
    if (count >= room.max_members) {
      setEntryStatus("Room is full.", "error");
      return;
    }
    const { error } = await addMember(code, myPeerId, myName, "Member");
    if (error) {
      console.error(error);
      setEntryStatus("Failed to join room.", "error");
      return;
    }
    enterRoomUI(code, "Member");
  }

  async function addMember(roomCode, peerId, name, role) {
    if (!hasSupabase) return;
    return await supabase.from("members").upsert({
      room_code: roomCode,
      peer_id: peerId,
      name,
      role
    }, { onConflict: "room_code,peer_id" });
  }

  function enterRoomUI(code, role) {
    currentRoomCode = code;
    isHost = (role === "Host");
    myName = sanitize($("#guest-name-input").value || "User");
    const initial = myName.charAt(0).toUpperCase() || "U";

    displayRoomCode.textContent = code;
    myRoleBadge.textContent = role;
    memberCount.textContent = "1";
    document.getElementById("my-name").textContent = myName;
    document.getElementById("my-avatar").textContent = initial;

    membersList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = myName + " — " + role;
    li.setAttribute("data-peer-id", myPeerId);
    membersList.appendChild(li);

    entryScreen.classList.remove("active");
    chatScreen.classList.add("active");
    sidebar.classList.remove("active");

    // Subscribe to Supabase realtime updates for this room
    if (hasSupabase) subscribeToRoom(code);

    // Connect to existing members via DataConnection
    setTimeout(() => refreshMemberConnections(), 500);
  }

  function leaveRoom() {
    if (currentCall) endCall();
    // Close all data connections
    for (const [id, conn] of Object.entries(peerConnections)) {
      conn.close();
    }
    for (const key of Object.keys(peerConnections)) delete peerConnections[key];

    if (hasSupabase && currentRoomCode && myPeerId) {
      supabase.from("members").delete().match({ room_code: currentRoomCode, peer_id: myPeerId }).then();
      supabase.removeAllChannels(); // remove realtime subscriptions
    }
    currentRoomCode = null;
    isHost = false;
    membersList.innerHTML = "";
    chatScreen.classList.remove("active");
    entryScreen.classList.add("active");
    sidebar.classList.remove("active");
    setEntryStatus("");
  }

  /* ---------- SUPABASE REALTIME SUBSCRIPTION ---------- */
  function subscribeToRoom(roomCode) {
    if (!hasSupabase) return;

    // Listen for new members
    supabase
      .channel(`room-${roomCode}-members`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "members",
        filter: `room_code=eq.${roomCode}`
      }, (payload) => {
        refreshMemberList(roomCode);
      })
      .subscribe();

    // Listen for messages (fallback)
    supabase
      .channel(`room-${roomCode}-messages`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_code=eq.${roomCode}`
      }, (payload) => {
        const msg = payload.new;
        if (msg.sender_peer_id !== myPeerId) {
          addMessage(msg.sender_name, msg.content, false);
        }
      })
      .subscribe();
  }

  async function refreshMemberList(roomCode) {
    if (!hasSupabase || !roomCode) return;
    const { data } = await supabase.from("members").select("*").eq("room_code", roomCode);
    if (!data) return;
    membersList.innerHTML = "";
    data.forEach(m => {
      const li = document.createElement("li");
      li.textContent = m.name + " — " + m.role;
      li.setAttribute("data-peer-id", m.peer_id);
      membersList.appendChild(li);
    });
    memberCount.textContent = data.length;

    // Connect to new members
    data.forEach(m => {
      if (m.peer_id !== myPeerId && !peerConnections[m.peer_id]) {
        connectToMember(m.peer_id);
      }
    });
  }

  function refreshMemberConnections() {
    // For each member in list, connect if not already
    const lis = membersList.querySelectorAll("li");
    lis.forEach(li => {
      const peerId = li.getAttribute("data-peer-id");
      if (peerId && peerId !== myPeerId && !peerConnections[peerId]) {
        connectToMember(peerId);
      }
    });
  }

  /* ---------- EVENT LISTENERS (UI) ---------- */
  btnCreate.addEventListener("click", async () => {
    const name = sanitize($("#guest-name-input").value);
    const dob = $("#dob-input").value;
    const age = getAgeFromDob(dob);
    if (!name || age === null || age < 19) return; // validation handled in inline script
    if (!myPeerId) {
      setEntryStatus("Waiting for connection. Please try again in a moment.", "warning");
      return;
    }
    setEntryStatus("Creating...", "success");
    await createRoom();
  });

  btnJoin.addEventListener("click", async () => {
    const name = sanitize($("#guest-name-input").value);
    const dob = $("#dob-input").value;
    const age = getAgeFromDob(dob);
    const code = $("#room-code-input").value.trim().toUpperCase();
    if (!name || age === null || age < 19 || !code) return;
    if (!myPeerId) {
      setEntryStatus("Waiting for connection...", "warning");
      return;
    }
    setEntryStatus("Joining...", "success");
    await joinRoom(code);
  });

  btnSend.addEventListener("click", () => {
    const text = messageInput.value.trim();
    if (text) {
      sendMessage(text);
      messageInput.value = "";
    }
  });

  messageInput.addEventListener("keydown", (e) => {
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

  btnEndCall.addEventListener("click", endCall);

  // Report modal (keep simple, already wired)
  btnReport.addEventListener("click", () => reportModal.classList.remove("hidden"));
  btnCancelReport.addEventListener("click", () => reportModal.classList.add("hidden"));
  btnSubmitReport.addEventListener("click", () => {
    const text = $("#report-text").value.trim();
    if (!text) { alert("Please describe the issue."); return; }
    window.location.href = "mailto:nxdecore@gmail.com?subject=" + encodeURIComponent("QUICK PRIVATE CHAT Grievance") + "&body=" + encodeURIComponent(text);
    reportModal.classList.add("hidden");
  });

  // Reset call UI when leaving
  window.addEventListener("beforeunload", () => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
  });

  // Sidebar menu
  document.getElementById("btn-menu").addEventListener("click", () => sidebar.classList.add("active"));
  document.getElementById("btn-close-sidebar").addEventListener("click", () => sidebar.classList.remove("active"));

  // Copy code
  document.getElementById("copy-code-btn").addEventListener("click", async () => {
    const code = displayRoomCode.textContent.trim();
    if (code && code !== "----") {
      try {
        await navigator.clipboard.writeText(code);
        addSystemMessage("Room code copied.");
      } catch {
        prompt("Copy room code:", code);
      }
    }
  });

  // Load saved name from localStorage (already done by inline, but ensure)
  const savedName = localStorage.getItem("qpc_last_name");
  if (savedName && !$("#guest-name-input").value) $("#guest-name-input").value = savedName;

  function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    if (crypto?.getRandomValues) {
      const arr = new Uint32Array(6);
      crypto.getRandomValues(arr);
      for (let i = 0; i < 6; i++) code += chars[arr[i] % chars.length];
    } else {
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function getAgeFromDob(dobVal) {
    if (!dobVal) return null;
    const bd = new Date(dobVal + "T00:00:00");
    if (isNaN(bd.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - bd.getFullYear();
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
    return age;
  }

  // Signal readiness
  window.__qpcCoreReady = true;
})();
