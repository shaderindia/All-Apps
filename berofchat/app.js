/* ============================================================
   QUICK PRIVATE CHAT by SHADER7 — app.js v9
   Peer-to-peer rooms (up to 4 people), direct chats with saved
   friends, and mesh voice/video calls over PeerJS / WebRTC.
   ============================================================ */
(function () {
  "use strict";

  const APP_VERSION = "9.0.0";
  const MAX_ROOM_MEMBERS = 4;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------------- Storage ---------------- */
  const store = {
    get(key, fallback = null) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch (e) {} },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} },
    json(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    setJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  };

  function randomCode(length, chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") {
    let out = "";
    const values = new Uint32Array(length);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(values);
    else for (let i = 0; i < length; i++) values[i] = Math.floor(Math.random() * 1e9);
    for (let i = 0; i < length; i++) out += chars[values[i] % chars.length];
    return out;
  }

  let myPersonalId = store.get("qpc_personal_id");
  if (!myPersonalId || !/^QPC-[A-Z0-9]{3,16}$/.test(myPersonalId)) {
    myPersonalId = "QPC-" + randomCode(8);
    store.set("qpc_personal_id", myPersonalId);
  }

  /* ---------------- DOM ---------------- */
  const el = {
    entry: $("#entry-screen"), chat: $("#chat-screen"), sidebar: $("#sidebar"), scrim: $("#sidebar-scrim"),
    name: $("#guest-name-input"), roomCode: $("#room-code-input"), dob: $("#dob-input"), tos: $("#tos-checkbox"),
    maskIp: $("#mask-ip-checkbox"), maxMembers: $("#max-members-create"), status: $("#entry-status"),
    btnCreate: $("#btn-create"), btnJoin: $("#btn-join"), btnRejoin: $("#btn-rejoin"), btnLeave: $("#btn-leave"),
    leaveLabel: $("#leave-label"), checksSummary: $("#checks-summary"), checksBody: $("#checks-body"),
    input: $("#message-input"), send: $("#btn-send"), messages: $("#messages-container"),
    roomCodeDisplay: $("#display-room-code"), roomCardLabel: $("#room-card-label"), capacity: $("#room-capacity"),
    roomCard: $("#room-card"), title: $("#chat-header-title"), memberCount: $("#member-count"), members: $("#members-list"),
    myRole: $("#my-role-badge"), myName: $("#my-name"), myAvatar: $("#my-avatar"), conn: $("#connection-status"),
    btnMenu: $("#btn-menu"), btnCloseSidebar: $("#btn-close-sidebar"), copyCode: $("#copy-code-btn"), copyInvite: $("#copy-invite-btn"),
    callStage: $("#call-stage"), tiles: $("#video-grid"), callLabel: $("#call-label"),
    btnVoice: $("#btn-voice-call"), btnVideo: $("#btn-video-call"), btnJoinCall: $("#btn-join-call"),
    ctrlMic: $("#ctrl-mute-mic"), ctrlCam: $("#ctrl-mute-cam"), ctrlEnd: $("#ctrl-end-call"),
    incoming: $("#incoming-call-modal"), callerName: $("#caller-name-display"), callerDetail: $("#caller-detail"), callerAvatar: $("#caller-avatar"),
    btnAccept: $("#btn-accept-call"), btnDecline: $("#btn-decline-call"),
    directModal: $("#direct-request-modal"), directName: $("#direct-request-name"), directDetail: $("#direct-request-detail"), directAvatar: $("#direct-request-avatar"),
    btnAcceptDirect: $("#btn-accept-direct"), btnDeclineDirect: $("#btn-decline-direct"),
    typing: $("#typing-indicator"), scrollBtn: $("#scroll-to-bottom"), unread: $("#unread-badge"),
    searchBar: $("#search-bar"), searchInput: $("#search-input"), searchCount: $("#search-count"), btnSearch: $("#btn-search"), btnCloseSearch: $("#btn-close-search"),
    ctxMenu: $("#message-context-menu"), ctxCopy: $("#btn-context-copy"),
    emojiBtn: $("#btn-emoji"), emojiPicker: $("#emoji-picker"), toasts: $("#toasts")
  };

  /* ---------------- State ---------------- */
  let peer = null;
  let myPeerId = "";
  let myName = "";
  let roomCode = "";
  let isHost = false;
  let session = null;            // null | "room" | "direct"
  let roomMaxMembers = MAX_ROOM_MEMBERS;
  let isUserLeaving = false;
  let roomClosed = false;
  let personalPeerPromise = null;
  let entryBusy = false;          // a create / join / friend request is in progress
  let leaving = false;
  let cancelFriendRequest = null;

  const connections = new Map();  // peerId -> DataConnection
  const members = new Map();      // peerId -> { name, role, personalId }
  const seenEvents = new Set();   // event ids already handled (dedupe mesh + host relay)
  const lastHeartbeats = new Map();
  const reconnectAttempts = new Map();
  const typingPeople = new Map(); // peerId -> { name, timer }
  const tickEls = new Map();      // msgId -> tick element
  let heartbeatTimer = null;
  let presenceTimer = null;

  // Calls
  let localStream = null;
  let inCall = false;
  let callMediaType = "voice";
  let callDeclined = false;
  let pendingInvite = null;                 // { from, name, mediaType }
  const callParticipants = new Set();       // peers in the current room call (not me)
  const activeCalls = new Map();            // peerId -> MediaConnection
  let isMicMuted = false;
  let isCamOff = false;

  // Misc UI state
  let lastMessageAt = 0;
  let lastMessageText = "";
  let typingSentAt = 0;
  let typingStopTimer = null;
  let unreadTitleCount = 0;
  let scrollUnread = 0;
  let lastRow = null;                       // { sender, time } for grouping
  let audioCtx = null;
  let notificationAsked = false;
  const originalTitle = document.title;

  /* ============================================================
     UTILITIES
     ============================================================ */
  function sanitize(value, max = 50) {
    return String(value || "").replace(/[<>]/g, "").replace(/[\u0000-\u0008\u000B-\u001F]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max);
  }
  function sanitizeMessage(value) {
    return String(value || "").replace(/[\u0000-\u0008\u000B-\u001F]/g, "").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, 1000);
  }
  function eventId() { return Date.now().toString(36) + "-" + randomCode(6, "abcdefghijkmnpqrstuvwxyz23456789"); }
  function formatTime(ts) {
    const d = new Date(ts || Date.now());
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function hueFor(text) {
    let h = 0; const s = String(text || "?");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function makeAvatar(name, key, cls = "") {
    const span = document.createElement("span");
    span.className = "avatar " + cls;
    span.style.setProperty("--hue", hueFor(key || name));
    span.textContent = (sanitize(name, 20).charAt(0) || "?").toUpperCase();
    span.setAttribute("aria-hidden", "true");
    return span;
  }
  function setAvatar(node, name, key) {
    if (!node) return;
    node.style.setProperty("--hue", hueFor(key || name));
    node.textContent = (sanitize(name, 20).charAt(0) || "?").toUpperCase();
  }
  function icon(name) { const i = document.createElement("i"); i.className = name; i.setAttribute("aria-hidden", "true"); return i; }

  function toast(text, iconName = "fa-solid fa-circle-check", ms = 2600) {
    if (!el.toasts) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.appendChild(icon(iconName));
    const span = document.createElement("span"); span.textContent = text; t.appendChild(span);
    el.toasts.appendChild(t);
    setTimeout(() => { t.classList.add("leaving"); setTimeout(() => t.remove(), 220); }, ms);
  }

  function openModal(node) { node?.classList.remove("hidden"); const f = node?.querySelector("[data-autofocus]") || node?.querySelector("button, input, textarea, a"); setTimeout(() => f?.focus(), 30); }
  function closeModal(node) { node?.classList.add("hidden"); }

  function confirmDialog(title, text, okLabel = "Confirm") {
    return new Promise((resolve) => {
      const modal = $("#confirm-modal");
      $("#confirm-title").textContent = title;
      $("#confirm-text").textContent = text;
      const ok = $("#btn-confirm-ok"), cancel = $("#btn-confirm-cancel");
      ok.textContent = okLabel;
      const done = (v) => { closeModal(modal); ok.onclick = cancel.onclick = null; modal.onkeydown = null; resolve(v); };
      ok.onclick = () => done(true);
      cancel.onclick = () => done(false);
      modal.onkeydown = (e) => { if (e.key === "Escape") done(false); };
      openModal(modal);
      setTimeout(() => cancel.focus(), 40);
    });
  }

  async function copyText(text, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      ta.remove();
    }
    toast(okMessage || "Copied", "fa-regular fa-copy");
  }

  function setEntryStatus(message, type = "error") {
    if (!el.status) return;
    el.status.textContent = message || "";
    el.status.dataset.type = type;
  }

  function setConnectionStatus(text, state = "ready") {
    if (!el.conn) return;
    el.conn.classList.remove("connected", "offline");
    if (state === "connected") el.conn.classList.add("connected");
    if (state === "offline") el.conn.classList.add("offline");
    el.conn.innerHTML = "";
    const dot = document.createElement("span"); dot.className = "conn-dot"; dot.setAttribute("aria-hidden", "true");
    el.conn.appendChild(dot);
    el.conn.appendChild(document.createTextNode(" " + sanitize(text, 60)));
  }

  function getAgeFromDob(value) {
    if (!value) return null;
    const birth = new Date(value + "T00:00:00");
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }

  function memberName(peerId, fallback) {
    return members.get(peerId)?.name || sanitize(fallback, 20) || "Someone";
  }

  /* ============================================================
     ENTRY SCREEN
     ============================================================ */
  function checksValid() {
    const age = getAgeFromDob(el.dob?.value || "");
    return age !== null && age >= 19 && el.tos?.checked;
  }

  function refreshChecksSummary(forceOpen) {
    const ok = checksValid() && store.get("qpc_last_dob") === el.dob.value && !forceOpen;
    el.checksSummary?.classList.toggle("hidden", !ok);
    el.checksBody?.classList.toggle("hidden", !!ok);
  }

  function validateEntry(requireRoomCode) {
    const name = sanitize(el.name?.value, 20);
    const age = getAgeFromDob(el.dob?.value || "");
    if (!name) { setEntryStatus("Enter a display name first."); el.name?.focus(); return false; }
    if (age === null) { refreshChecksSummary(true); setEntryStatus("Enter your date of birth to confirm you are 19 or older."); el.dob?.focus(); return false; }
    if (age < 19) { refreshChecksSummary(true); setEntryStatus("You must be 19 or older to use Quick Private Chat."); el.dob?.focus(); return false; }
    if (!el.tos?.checked) { refreshChecksSummary(true); setEntryStatus("Please agree to the Terms of Service and Privacy Policy."); el.tos?.focus(); return false; }
    if (requireRoomCode && sanitize(el.roomCode?.value, 8).length < 4) { setEntryStatus("Enter the room code you were given."); el.roomCode?.focus(); return false; }
    store.set("qpc_last_name", name);
    store.set("qpc_last_dob", el.dob.value);
    return true;
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) { button.dataset.label = button.innerHTML; button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> ' + label; }
    else if (button.dataset.label) { button.innerHTML = button.dataset.label; button.disabled = false; delete button.dataset.label; }
  }

  function selectTab(targetId) {
    $$(".tab-btn").forEach((b) => { const on = b.dataset.target === targetId; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === targetId));
    setEntryStatus("");
  }

  function initEntry() {
    $$(".tab-btn").forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.target)));

    $$(".size-opt").forEach((b) => b.addEventListener("click", () => {
      $$(".size-opt").forEach((o) => { o.classList.toggle("active", o === b); o.setAttribute("aria-checked", String(o === b)); });
      el.maxMembers.value = b.dataset.size;
    }));

    el.roomCode?.addEventListener("input", () => {
      el.roomCode.value = el.roomCode.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
    });
    el.roomCode?.addEventListener("keydown", (e) => { if (e.key === "Enter") joinRoom(); });
    el.name?.addEventListener("input", () => { el.name.value = el.name.value.replace(/[<>]/g, "").slice(0, 20); });
    el.name?.addEventListener("keydown", (e) => { if (e.key === "Enter") { const active = $(".tab-panel.active"); if (active?.id === "join-form") el.roomCode.focus(); else if (active?.id === "create-form") hostRoom(); } });

    const savedName = store.get("qpc_last_name");
    const savedDob = store.get("qpc_last_dob");
    if (savedName && !el.name.value) el.name.value = savedName;
    if (savedDob && !el.dob.value) el.dob.value = savedDob;
    if (store.get("qpc_tos_accepted") === "true") el.tos.checked = true;
    el.maskIp.checked = store.get("qpc_mask_ip") === "true";
    el.maskIp.addEventListener("change", () => {
      store.set("qpc_mask_ip", el.maskIp.checked);
      toast(el.maskIp.checked ? "Relay mode on. New connections avoid sharing your IP." : "Relay mode off.", "fa-solid fa-shield-halved");
      if (!session) initPersonalPeer();
    });
    refreshChecksSummary(false);
    $("#btn-edit-checks")?.addEventListener("click", () => refreshChecksSummary(true));

    const lastRoom = store.get("qpc_last_room");
    if (el.btnRejoin) {
      if (lastRoom) { el.btnRejoin.textContent = "Rejoin last room · " + lastRoom; el.btnRejoin.classList.remove("hidden"); }
      el.btnRejoin.addEventListener("click", () => { const r = store.get("qpc_last_room"); if (r) { el.roomCode.value = r; joinRoom(); } });
    }

    const params = new URLSearchParams(window.location.search);
    const invite = String(params.get("room") || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
    if (invite) {
      el.roomCode.value = invite;
      selectTab("join-form");
      el.btnRejoin?.classList.add("hidden");
      setEntryStatus("You were invited to room " + invite + ". Check your details, then join.", "info");
    }

    el.btnCreate?.addEventListener("click", hostRoom);
    el.btnJoin?.addEventListener("click", joinRoom);
    const year = $("#year"); if (year) year.textContent = String(new Date().getFullYear());
  }

  /* ============================================================
     PEER CREATION
     ============================================================ */
  function peerOptions() {
    const opts = { debug: 1 };
    if (store.get("qpc_mask_ip") === "true") {
      opts.config = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"], username: "peerjs", credential: "peerjsp" }
        ],
        iceTransportPolicy: "relay"
      };
    }
    return opts;
  }

  function createPeer(id) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === "undefined") { reject(new Error("The connection library did not load. Check your internet connection and refresh.")); return; }
      const p = new Peer(id, peerOptions());
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { p.destroy(); } catch (e) {}
        reject(Object.assign(new Error("Timed out reaching the connection server."), { type: "timeout" }));
      }, 12000);

      p.on("open", (openedId) => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        resolve({ peerInstance: p, id: openedId });
      });
      p.on("disconnected", () => {
        if (p !== peer || p.destroyed) return;
        setConnectionStatus("Reconnecting to server…", "ready");
        setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 1000);
      });
      p.on("error", (err) => {
        if (!settled) { settled = true; clearTimeout(timeout); reject(err); return; }
        handlePeerError(p, err);
      });
    });
  }

  function handlePeerError(p, err) {
    const type = String(err?.type || "");
    if (type === "peer-unavailable") {
      const missing = String(err.message || "").split(" ").pop();
      if (pendingDial && pendingDial.target === missing) { pendingDial.fail(); return; }
      if (session && members.has(missing)) attemptReconnect(missing);
      return;
    }
    if (type === "network" || type === "server-error" || type === "socket-error") {
      if (session) setConnectionStatus("Connection server unreachable", "offline");
      return;
    }
    console.warn("[QPC] peer error", err);
  }

  function destroyPeer() {
    connections.forEach((c) => { try { c.close(); } catch (e) {} });
    connections.clear();
    members.clear();
    try { if (peer && !peer.destroyed) peer.destroy(); } catch (e) {}
    peer = null;
    myPeerId = "";
    stopHeartbeat();
  }

  function wirePeer(p) {
    p.on("connection", onIncomingConnection);
    p.on("call", onIncomingMedia);
  }

  async function initPersonalPeer() {
    if (session) return;
    if (personalPeerPromise) { try { await personalPeerPromise; } catch (e) {} if (session) return; }
    destroyPeer();
    personalIdTaken = false;
    const attempt = (async () => {
      try {
        const result = await createPeer(myPersonalId);
        if (session) { try { result.peerInstance.destroy(); } catch (e) {} return; }
        peer = result.peerInstance;
        myPeerId = result.id;
        wirePeer(peer);
      } catch (err) {
        if (String(err?.type) === "unavailable-id") {
          personalIdTaken = true;
          console.warn("[QPC] Call code is open in another tab; direct chats will reach that tab.");
        } else {
          console.warn("[QPC] Could not start background listener:", err);
        }
      }
    })();
    personalPeerPromise = attempt;
    attempt.finally(() => { if (personalPeerPromise === attempt) personalPeerPromise = null; });
    return attempt;
  }
  let personalIdTaken = false;

  // A peer for joining rooms / starting chats. Uses the call code, or a
  // throwaway id when the call code is already open in another tab.
  async function ensureSessionPeer() {
    try { await ensurePersonalPeer(); }
    catch (err) {
      if (String(err?.type) !== "unavailable-id") throw err;
      personalIdTaken = true;
      destroyPeer();
      const result = await createPeer(myPersonalId + "-" + randomCode(4));
      peer = result.peerInstance; myPeerId = result.id; wirePeer(peer);
    }
  }

  async function ensurePersonalPeer() {
    if (peer && !peer.destroyed && peer.open !== false && (peer.id === myPersonalId || peer.id.startsWith(myPersonalId + "-"))) return;
    if (personalPeerPromise) { try { await personalPeerPromise; } catch (e) {} }
    if (peer && !peer.destroyed && peer.id === myPersonalId) return;
    destroyPeer();
    const result = await createPeer(myPersonalId);
    peer = result.peerInstance;
    myPeerId = result.id;
    wirePeer(peer);
  }

  /* ============================================================
     MESSAGING TRANSPORT
     ============================================================ */
  function sendTo(peerId, data) {
    const c = connections.get(peerId);
    if (c && c.open) { try { c.send(data); } catch (e) {} }
  }
  function sendAll(data) {
    connections.forEach((c) => { if (c && c.open) { try { c.send(data); } catch (e) {} } });
  }
  // Broadcast an event that must reach every member exactly once.
  function broadcast(data) {
    const evt = Object.assign({ eid: eventId(), from: myPeerId }, data);
    seenEvents.add(evt.eid);
    sendAll(evt);
    return evt;
  }
  const RELAYED = new Set(["message", "call-started", "call-joined", "call-left", "call-ended", "call-declined", "room-closed"]);
  function relayAsHost(senderId, data) {
    if (!isHost || session !== "room" || !RELAYED.has(data.type)) return;
    connections.forEach((c, id) => { if (id !== senderId && c.open) { try { c.send(data); } catch (e) {} } });
  }

  function onIncomingConnection(conn) {
    // Accept the transport, then decide from the hello message.
    setupConnection(conn);
  }

  function setupConnection(conn, opts = {}) {
    if (!conn) return;
    const existing = connections.get(conn.peer);
    if (existing && existing.open && existing !== conn) {
      // Keep the open link; drop the duplicate once it opens.
      conn.on("open", () => { try { conn.close(); } catch (e) {} });
      return;
    }
    connections.set(conn.peer, conn);

    conn.on("open", () => {
      try {
        conn.send({ type: "hello", id: myPeerId, personalId: myPersonalId, name: myName, role: isHost ? "Host" : "Member", roomCode: session === "room" ? roomCode : "", session: session || "", v: APP_VERSION });
      } catch (e) {}
      if (isHost && session === "room") sendMemberListTo(conn);
      reconnectAttempts.delete(conn.peer);
      if (session) setConnectionStatus(statusLabel(), "connected");
    });
    conn.on("data", (data) => handleData(conn.peer, data, conn));
    conn.on("close", () => onConnectionClosed(conn));
    conn.on("error", () => onConnectionClosed(conn));
  }

  function onConnectionClosed(conn) {
    if (connections.get(conn.peer) !== conn) return;
    connections.delete(conn.peer);
    const wasMember = members.has(conn.peer);
    if (!wasMember || isUserLeaving || roomClosed || !session) return;
    // The host links everyone; if we lose it, try to reconnect before giving up.
    if (session === "room" && !isHost && conn.peer === roomCode) { attemptReconnect(conn.peer); return; }
    if (session === "direct") { attemptReconnect(conn.peer); return; }
    if (isHost) { handleMemberLeft(conn.peer, true); return; }
    attemptReconnect(conn.peer);
  }

  function attemptReconnect(peerId) {
    if (!session || isUserLeaving || roomClosed || !peer || peer.destroyed) return;
    let a = reconnectAttempts.get(peerId);
    if (!a) { a = { count: 0, timer: null }; reconnectAttempts.set(peerId, a); }
    if (a.timer) return;
    if (a.count >= 3) {
      reconnectAttempts.delete(peerId);
      const name = memberName(peerId);
      if (session === "room" && peerId === roomCode && !isHost) { forceExitRoom("Lost connection to the host. The room has ended."); return; }
      handleMemberLeft(peerId, true);
      addSystemMessage("Lost connection to " + name + ".", "warn");
      return;
    }
    a.count++;
    if (peerId === roomCode || session === "direct") setConnectionStatus("Reconnecting… (" + a.count + "/3)", "ready");
    a.timer = setTimeout(() => {
      a.timer = null;
      if (!session || !peer || peer.destroyed) return;
      if (connections.get(peerId)?.open) { reconnectAttempts.delete(peerId); return; }
      try {
        const conn = peer.connect(peerId, { reliable: true });
        setupConnection(conn);
        setTimeout(() => { if (!conn.open && session) attemptReconnect(peerId); }, 5000);
      } catch (e) { attemptReconnect(peerId); }
    }, Math.pow(2, a.count) * 1000);
  }

  function sendMemberListTo(conn) {
    try { conn.send(memberListPayload()); } catch (e) {}
  }
  function memberListPayload() {
    return {
      type: "member-list",
      maxMembers: roomMaxMembers,
      members: Array.from(members.entries()).map(([id, m]) => ({ id, name: m.name, role: m.role, personalId: m.personalId || id }))
    };
  }
  function broadcastMemberList() { sendAll(memberListPayload()); }

  function connectToAllKnownMembers() {
    if (!peer || !myPeerId || session !== "room") return;
    members.forEach((m, id) => {
      if (!id || id === myPeerId || id === roomCode) return;
      if (connections.get(id)?.open) return;
      if (connections.has(id)) return; // already dialing
      if (String(myPeerId) > String(id)) return; // the other side dials us: one link per pair
      try { setupConnection(peer.connect(id, { reliable: true })); } catch (e) {}
    });
  }

  /* ============================================================
     INCOMING DATA
     ============================================================ */
  function handleData(senderId, data, conn) {
    if (!data || typeof data !== "object") return;

    const known = members.has(senderId);
    if (known) lastHeartbeats.set(senderId, Date.now());
    const OPEN_TYPES = ["hello", "busy", "room-full"];
    if (!known && !OPEN_TYPES.includes(data.type)) return; // ignore anyone who isn't in this room/chat

    if (data.eid) {
      if (typeof data.eid !== "string" || seenEvents.has(data.eid)) return;
      seenEvents.add(data.eid);
      if (seenEvents.size > 2000) seenEvents.delete(seenEvents.values().next().value);
      relayAsHost(senderId, data);
    }
    // Only the host may speak on behalf of someone else (when relaying).
    const origin = (data.from && senderId === roomCode && session === "room" && members.has(data.from)) ? data.from : senderId;

    switch (data.type) {
      case "hello": return onHello(senderId, data, conn);
      case "member-list": return onMemberList(senderId, data);
      case "room-full":
        if (session === "room" && !isHost) failJoin("That room is full (" + (Number(data.maxMembers) || MAX_ROOM_MEMBERS) + " people). Ask the host for a bigger room.");
        return;
      case "busy":
        pendingReason = data.reason === "declined" ? "declined" : "busy";
        if (pendingDial && pendingDial.target === senderId) pendingDial.fail(pendingReason);
        if (session === "direct" && senderId === directPartner && !members.has(senderId)) { try { conn?.close(); } catch (e) {} }
        try { conn?.close(); } catch (e) {}
        return;
      case "room-closed":
        if (!isHost && session === "room" && senderId === roomCode) forceExitRoom(memberName(origin, data.name) + " closed the room.");
        return;
      case "message": return onMessage(origin, data);
      case "msg-ack": return onAck(data);
      case "typing": return onTyping(senderId, data);
      case "heartbeat": lastHeartbeats.set(senderId, Date.now()); return;
      case "member-left": return handleMemberLeft(senderId, false);
      case "call-started": return onCallStarted(origin, data);
      case "call-state": return onCallState(senderId, data);
      case "call-joined": return onCallJoined(origin, data);
      case "call-left":
      case "call-ended": return onCallLeft(origin, data);
      case "media-state":
        remoteMedia.set(senderId, { muted: !!data.muted, camOff: !!data.camOff });
        applyRemoteMedia(senderId);
        return;
      case "call-declined":
        if (inCall) addSystemMessage(memberName(origin, data.name) + " declined the call.");
        return;
      default: return;
    }
  }

  function onHello(senderId, data, conn) {
    const name = sanitize(data.name, 20) || "Guest";
    lastHeartbeats.set(senderId, Date.now());

    if (session === "room") {
      if (data.roomCode !== roomCode && senderId !== roomCode) {
        // Someone tried a direct chat while we're in a room.
        try { conn.send({ type: "busy", reason: "in-room" }); } catch (e) {}
        setTimeout(() => { try { conn.close(); } catch (e) {} }, 200);
        return;
      }
      if (isHost && !members.has(senderId) && members.size >= roomMaxMembers) {
        try { conn.send({ type: "room-full", maxMembers: roomMaxMembers }); } catch (e) {}
        setTimeout(() => { try { conn.close(); } catch (e) {} }, 200);
        addSystemMessage(name + " tried to join, but the room is full.");
        return;
      }
      const isNew = !members.has(senderId);
      members.set(senderId, { name, role: senderId === roomCode ? "Host" : "Member", personalId: sanitize(data.personalId, 20) || senderId });
      updateMembersUI();
      if (isHost) {
        if (isNew) addSystemMessage(name + " joined the room.");
        broadcastMemberList();
      }
      if (inCall || callParticipants.size) {
        try { conn.send({ type: "call-state", mediaType: callMediaType, participants: Array.from(callParticipants).concat(inCall ? [myPeerId] : []) }); } catch (e) {}
      }
      return;
    }

    if (session === "direct") {
      if (directPartner && senderId === directPartner) {
        if (data.session !== "direct") return; // they haven't accepted yet
        members.set(senderId, { name, role: "Friend", personalId: senderId });
        updateMembersUI();
        el.title.textContent = name;
        return;
      }
      try { conn.send({ type: "busy", reason: "in-chat" }); } catch (e) {}
      setTimeout(() => { try { conn.close(); } catch (e) {} }, 200);
      return;
    }

    // Not in a session: this is a direct chat request.
    if (data.roomCode || data.session === "room") { try { conn.close(); } catch (e) {} return; }
    showDirectRequest(senderId, name, conn);
  }

  function onMemberList(senderId, data) {
    if (session !== "room" || isHost || senderId !== roomCode) return;
    roomMaxMembers = Math.max(2, Math.min(MAX_ROOM_MEMBERS, Number(data.maxMembers) || MAX_ROOM_MEMBERS));
    const incoming = Array.isArray(data.members) ? data.members.slice(0, MAX_ROOM_MEMBERS) : [];
    const before = new Set(members.keys());
    members.clear();
    incoming.forEach((m) => {
      if (!m || !m.id) return;
      members.set(String(m.id), { name: sanitize(m.name, 20) || "Guest", role: m.id === roomCode ? "Host" : "Member", personalId: sanitize(m.personalId, 20) || m.id });
      if (!lastHeartbeats.has(m.id)) lastHeartbeats.set(m.id, Date.now());
    });
    if (!members.has(myPeerId)) members.set(myPeerId, { name: myName, role: "Member", personalId: myPersonalId });
    if (joinedOnce) {
      members.forEach((m, id) => { if (!before.has(id) && id !== myPeerId) addSystemMessage(m.name + " joined the room."); });
      before.forEach((id) => {
        if (!members.has(id) && id !== myPeerId) { dropPeer(id); }
      });
    }
    joinedOnce = true;
    updateMembersUI();
    connectToAllKnownMembers();
  }
  let joinedOnce = false;

  function onMessage(origin, data) {
    if (origin === myPeerId) return;
    const text = sanitizeMessage(data.text);
    if (!text) return;
    const name = memberName(origin, data.name);
    addChatMessage({ sender: name, senderId: origin, text, own: false, time: Date.now() });
    clearTyping(origin);
    if (data.msgId) {
      const ack = { type: "msg-ack", msgId: String(data.msgId).slice(0, 40) };
      if (connections.get(origin)?.open) sendTo(origin, ack);
      else sendAll(Object.assign({ to: origin }, ack)); // the host passes it on
    }
    if (!notificationAsked) askNotifications();
    if (document.hidden) {
      playTone([800, 1000], 0.1);
      try { navigator.vibrate && navigator.vibrate([80, 40, 80]); } catch (e) {}
      unreadTitleCount++;
      updateTitleBadge();
      showNotification(name, text);
    }
  }

  function onAck(data) {
    if (data.to && data.to !== myPeerId) {
      // Relay acks for members we can't reach directly.
      if (isHost) sendTo(data.to, { type: "msg-ack", msgId: data.msgId });
      return;
    }
    const tick = tickEls.get(String(data.msgId || ""));
    if (tick && !tick.classList.contains("delivered")) {
      tick.classList.add("delivered");
      tick.innerHTML = '<i class="fa-solid fa-check-double" aria-hidden="true"></i>';
      tick.title = "Delivered";
    }
  }

  /* ============================================================
     ROOMS
     ============================================================ */
  async function hostRoom() {
    if (entryBusy || session) return;
    if (!validateEntry(false)) return;
    entryBusy = true;
    setBusy(el.btnCreate, true, "Creating room…");
    setEntryStatus("");
    myName = sanitize(el.name.value, 20);
    roomMaxMembers = Math.max(2, Math.min(MAX_ROOM_MEMBERS, Number(el.maxMembers.value) || MAX_ROOM_MEMBERS));

    for (let tries = 0; tries < 3; tries++) {
      const code = randomCode(6);
      try {
        destroyPeer();
        const result = await createPeer(code);
        peer = result.peerInstance;
        myPeerId = result.id;
        wirePeer(peer);
        roomCode = code; isHost = true; session = "room"; roomClosed = false; isUserLeaving = false; joinedOnce = true;
        members.set(myPeerId, { name: myName, role: "Host", personalId: myPersonalId });
        enterChat();
        setBusy(el.btnCreate, false);
        entryBusy = false;
        return;
      } catch (err) {
        if (String(err?.type) === "unavailable-id") continue;
        console.error(err);
        setEntryStatus(err?.type === "timeout" ? "Couldn't reach the connection server. Check your internet and try again." : "Couldn't create the room. Check your connection and try again.");
        break;
      }
    }
    setBusy(el.btnCreate, false);
    entryBusy = false;
    if (!session) initPersonalPeer();
  }

  let pendingDial = null;

  function dial(target, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const conn = peer.connect(target, { reliable: true });
      const finish = (ok, reason) => {
        if (done) return; done = true; clearTimeout(timer); pendingDial = null;
        if (ok) resolve(conn); else { try { conn.close(); } catch (e) {} connections.delete(target); reject(Object.assign(new Error(reason || "unavailable"), { reason: reason || "unavailable" })); }
      };
      pendingDial = { target, fail: (r) => finish(false, r || "unavailable") };
      setupConnection(conn);
      conn.on("open", () => finish(true));
      const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);
    });
  }

  async function joinRoom() {
    if (entryBusy || session) return;
    if (!validateEntry(true)) return;
    entryBusy = true;
    const code = sanitize(el.roomCode.value, 8).toUpperCase();
    setBusy(el.btnJoin, true, "Joining…");
    setEntryStatus("");
    myName = sanitize(el.name.value, 20);
    try {
      await ensureSessionPeer();
      connections.forEach((c) => { try { c.close(); } catch (e) {} });
      connections.clear(); members.clear();
      roomCode = code; isHost = false; session = "room"; roomClosed = false; isUserLeaving = false; joinedOnce = false;
      members.set(myPeerId, { name: myName, role: "Member", personalId: myPersonalId });
      await dial(code, 9000);
      // Wait for the host's member list (or a "room full" reply) before showing the room.
      for (let i = 0; i < 40 && session === "room" && !joinedOnce; i++) await new Promise((r) => setTimeout(r, 100));
      if (session !== "room") return;
      enterChat();
      addSystemMessage("You joined room " + roomCode + ". Keep this tab open to stay in the room.");
    } catch (err) {
      session = null; roomCode = ""; members.clear();
      const reason = err?.reason;
      if (reason === "unavailable" || reason === "timeout") setEntryStatus("Room " + code + " wasn't found, or its host is offline. Check the code and try again.", "warning");
      else if (!el.status.textContent) setEntryStatus("Couldn't join. Check your internet connection and try again.");
      if (!peer) initPersonalPeer();
    } finally {
      setBusy(el.btnJoin, false);
      entryBusy = false;
    }
  }

  function failJoin(message) {
    isUserLeaving = true;
    session = null; roomCode = ""; members.clear();
    connections.forEach((c) => { try { c.close(); } catch (e) {} });
    connections.clear();
    stopHeartbeat();
    showEntry(message, "warning");
    setTimeout(() => { isUserLeaving = false; }, 300);
  }

  function enterChat() {
    const role = session === "direct" ? "Direct chat" : isHost ? "Host" : "Member";
    el.myName.textContent = myName;
    el.myRole.textContent = role;
    setAvatar(el.myAvatar, myName, myPersonalId);
    el.leaveLabel.textContent = session === "room" && isHost ? "Close room" : "Leave";

    if (session === "room") {
      el.roomCard.classList.remove("hidden");
      el.roomCardLabel.textContent = "Room code";
      el.roomCodeDisplay.textContent = roomCode;
      el.title.textContent = "Room " + roomCode;
      if (!isHost) store.set("qpc_last_room", roomCode);
    } else {
      el.roomCard.classList.add("hidden");
    }

    el.messages.innerHTML = "";
    lastRow = null;
    tickEls.clear();
    resetComposer();
    if (session === "direct" || isHost) renderEmptyState();
    el.entry.classList.remove("active");
    el.chat.classList.add("active");
    document.body.classList.add("in-chat");
    closeSidebar();
    setConnectionStatus(statusLabel(), "connected");
    updateMembersUI();
    startHeartbeat();
    setTimeout(() => el.input?.focus(), 50);
  }

  function statusLabel() {
    if (session === "direct") return !members.has(directPartner) ? "Your friend left" : connections.get(directPartner)?.open ? "Connected directly" : "Reconnecting…";
    const n = members.size;
    return isHost ? "Hosting · " + n + " of " + roomMaxMembers : "Connected · " + n + " of " + roomMaxMembers;
  }

  function renderEmptyState() {
    if (!el.messages || el.messages.querySelector(".empty-chat")) return;
    const box = document.createElement("div");
    box.className = "empty-chat";
    const ico = document.createElement("div"); ico.className = "empty-ico"; ico.appendChild(icon(session === "direct" ? "fa-solid fa-user-group" : "fa-solid fa-comments"));
    const strong = document.createElement("strong");
    const p = document.createElement("span");
    box.appendChild(ico); box.appendChild(strong); box.appendChild(p);
    if (session === "room") {
      strong.textContent = isHost ? "Your room is ready" : "You're in";
      p.textContent = isHost ? "Share the code " + roomCode + " or the invite link with up to " + (roomMaxMembers - 1) + (roomMaxMembers - 1 === 1 ? " person" : " people") + " you know. If you leave, the room closes for everyone." : "Say hello. Messages appear here.";
      if (isHost) {
        const b = document.createElement("button"); b.type = "button"; b.className = "chip-btn"; b.appendChild(icon("fa-solid fa-link")); b.appendChild(document.createTextNode(" Copy invite link"));
        b.addEventListener("click", copyInviteLink); box.appendChild(b);
      }
    } else {
      strong.textContent = "Direct chat";
      p.textContent = "Only the two of you are here. Messages aren't saved after you leave.";
    }
    el.messages.appendChild(box);
  }

  function showEntry(statusText, statusType) {
    document.body.classList.remove("in-chat");
    el.chat.classList.remove("active");
    el.entry.classList.add("active");
    closeSidebar();
    closeSearch();
    clearAllTyping();
    unreadTitleCount = 0; updateTitleBadge();
    if (statusText) setEntryStatus(statusText, statusType || "warning"); else setEntryStatus("");
    renderFriendsList();
    const lastRoom = store.get("qpc_last_room");
    if (el.btnRejoin) {
      el.btnRejoin.classList.toggle("hidden", !lastRoom);
      if (lastRoom) el.btnRejoin.textContent = "Rejoin last room · " + lastRoom;
    }
  }

  function resetSession() {
    leaveCall(false);
    hideIncoming();
    destroyPeer();
    session = null; roomCode = ""; isHost = false; directPartner = ""; joinedOnce = false;
    callParticipants.clear();
    reconnectAttempts.forEach((a) => clearTimeout(a.timer));
    reconnectAttempts.clear();
    updateCallButtons();
  }

  async function leaveRoom() {
    if (!session || leaving) return;
    if (session === "room" && isHost && members.size > 1) {
      const ok = await confirmDialog("Close this room?", "Everyone will be disconnected and the room code stops working.", "Close room");
      if (!ok) return;
    }
    if (!session || leaving) return;
    leaving = true;
    isUserLeaving = true;
    if (session === "room" && isHost) broadcast({ type: "room-closed", name: myName });
    else sendAll({ type: "member-left", id: myPeerId });
    const leftDirect = session === "direct";
    setTimeout(() => {
      resetSession();
      showEntry(leftDirect ? "" : "");
      isUserLeaving = false;
      leaving = false;
      initPersonalPeer();
    }, 120);
  }

  function forceExitRoom(message) {
    if (roomClosed) return;
    if (store.get("qpc_last_room") === roomCode) store.remove("qpc_last_room");
    roomClosed = true; isUserLeaving = true;
    resetSession();
    showEntry(message || "The room has ended.", "warning");
    setTimeout(() => { isUserLeaving = false; roomClosed = false; initPersonalPeer(); }, 400);
  }

  function dropPeer(peerId) {
    const c = connections.get(peerId);
    connections.delete(peerId);
    try { c?.close(); } catch (e) {}
    members.delete(peerId);
    lastHeartbeats.delete(peerId);
    clearTyping(peerId);
    removeFromCall(peerId);
  }

  function handleMemberLeft(peerId, silentConnLoss) {
    if (!peerId || peerId === myPeerId) return;
    if (session === "room" && !isHost && peerId === roomCode) {
      forceExitRoom(memberName(peerId) + " (the host) left. The room has ended.");
      return;
    }
    const m = members.get(peerId);
    dropPeer(peerId);
    updateMembersUI();
    if (m) addSystemMessage(m.name + (session === "direct" ? " left the chat." : " left the room."));
    if (isHost && session === "room") broadcastMemberList();
    if (session === "direct" && peerId === directPartner) {
      setConnectionStatus("Your friend left", "offline");
      el.input.disabled = true; el.send.disabled = true;
      el.input.placeholder = "This chat has ended";
    }
  }

  /* ============================================================
     DIRECT CHATS (FRIENDS)
     ============================================================ */
  let directPartner = "";
  let pendingDirect = null;

  function showDirectRequest(peerId, name, conn) {
    if (pendingDirect) { try { conn.send({ type: "busy", reason: "busy" }); conn.close(); } catch (e) {} return; }
    pendingDirect = { peerId, name, conn };
    const saved = getFriends().find((f) => f.personalId === peerId);
    el.directName.textContent = saved ? saved.name : name;
    el.directDetail.textContent = (saved ? "" : "Not in your friends · ") + peerId + " wants to start a direct chat";
    setAvatar(el.directAvatar, saved ? saved.name : name, peerId);
    openModal(el.directModal);
    playTone([660, 880], 0.12);
    conn.on("close", () => { if (pendingDirect && pendingDirect.conn === conn) { pendingDirect = null; closeModal(el.directModal); toast(name + " cancelled the request.", "fa-solid fa-circle-info"); } });
  }

  function acceptDirect() {
    const req = pendingDirect;
    if (!req) return;
    const box = $("#direct-details");
    if (box && !box.classList.contains("hidden")) {
      // Copy the details typed in the request card into the main form.
      el.name.value = $("#direct-name-input").value;
      el.dob.value = $("#direct-dob-input").value;
      el.tos.checked = $("#direct-tos-checkbox").checked;
      if (el.tos.checked) store.set("qpc_tos_accepted", "true");
    }
    const problem = directDetailsProblem();
    if (problem) {
      box?.classList.remove("hidden");
      $("#direct-name-input").value = el.name.value;
      $("#direct-dob-input").value = el.dob.value;
      $("#direct-tos-checkbox").checked = el.tos.checked;
      $("#direct-details-status").textContent = problem;
      return;
    }
    validateEntry(false);
    box?.classList.add("hidden");
    pendingDirect = null;
    closeModal(el.directModal);
    myName = sanitize(el.name.value, 20);
    session = "direct"; directPartner = req.peerId; isHost = false; roomCode = "";
    members.clear();
    members.set(myPeerId, { name: myName, role: "You", personalId: myPersonalId });
    members.set(req.peerId, { name: req.name, role: "Friend", personalId: req.peerId });
    try { req.conn.send({ type: "hello", id: myPeerId, personalId: myPersonalId, name: myName, role: "Member", roomCode: "", session: "direct", v: APP_VERSION }); } catch (e) {}
    resetComposer();
    enterChat();
    el.title.textContent = req.name;
  }

  function directDetailsProblem() {
    const age = getAgeFromDob(el.dob.value || "");
    if (!sanitize(el.name.value, 20)) return "Enter a display name to accept.";
    if (age === null) return "Enter your date of birth to confirm you are 19 or older.";
    if (age < 19) return "You must be 19 or older to use Quick Private Chat.";
    if (!el.tos.checked) return "Agree to the Terms of Service and Privacy Policy to accept.";
    return "";
  }

  function declineDirect() {
    $("#direct-details")?.classList.add("hidden");
    const req = pendingDirect;
    pendingDirect = null;
    closeModal(el.directModal);
    if (!req) return;
    try { req.conn.send({ type: "busy", reason: "declined" }); } catch (e) {}
    setTimeout(() => { try { req.conn.close(); } catch (e) {} }, 200);
  }

  async function connectToFriend(friendId, friendName, button) {
    if (cancelFriendRequest && button?.dataset.waiting === "1") { cancelFriendRequest(); return; }
    if (entryBusy || session) return;
    if (!validateEntry(false)) return;
    entryBusy = true;
    myName = sanitize(el.name.value, 20);
    setEntryStatus("Asking " + friendName + " to chat… they need to accept on their side.", "info");
    const original = button ? button.innerHTML : "";
    if (button) { button.dataset.waiting = "1"; button.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i> Cancel'; button.title = "Cancel the request"; }
    let cancelled = false;
    let conn = null;
    cancelFriendRequest = () => { cancelled = true; pendingReason = "cancelled"; if (pendingDial) pendingDial.fail("cancelled"); connections.forEach((c) => { try { c.close(); } catch (e) {} }); };
    try {
      await ensureSessionPeer();
      if (cancelled) throw Object.assign(new Error("cancelled"), { reason: "cancelled" });
      connections.forEach((c) => { try { c.close(); } catch (e) {} });
      connections.clear(); members.clear();
      session = "direct"; directPartner = friendId; isHost = false; roomCode = "";
      members.set(myPeerId, { name: myName, role: "You", personalId: myPersonalId });
      conn = await dial(friendId, 8000);
      // Wait for their hello (sent when they accept).
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(Object.assign(new Error("no answer"), { reason: "noanswer" })), 45000);
        const check = () => {
          if (cancelled) { clearTimeout(t); reject(Object.assign(new Error("cancelled"), { reason: "cancelled" })); }
          else if (members.has(friendId)) { clearTimeout(t); resolve(); }
          else if (!conn.open || session !== "direct") { clearTimeout(t); reject(Object.assign(new Error("closed"), { reason: pendingReason || "declined" })); }
          else setTimeout(check, 200);
        };
        check();
      });
      resetComposer();
      enterChat();
      el.title.textContent = members.get(friendId)?.name || friendName;
      setEntryStatus("");
    } catch (err) {
      const reason = err?.reason;
      session = null; directPartner = ""; members.clear();
      connections.forEach((c) => { try { c.close(); } catch (e) {} });
      connections.clear();
      const msg = reason === "cancelled" ? "Request to " + friendName + " cancelled."
        : reason === "declined" ? friendName + " declined the chat."
        : reason === "busy" ? friendName + " is busy in another chat or room."
        : reason === "noanswer" ? friendName + " didn't answer."
        : friendName + " is offline. They need Quick Private Chat open to receive your request.";
      setEntryStatus(msg, reason === "cancelled" ? "info" : "warning");
      if (!cancelled) { try { conn && conn.close(); } catch (e) {} }
    } finally {
      pendingReason = "";
      cancelFriendRequest = null;
      entryBusy = false;
      if (button) { delete button.dataset.waiting; button.innerHTML = original; button.title = ""; }
    }
  }
  let pendingReason = "";

  function getFriends() { const list = store.json("qpc_friends_list", []); return Array.isArray(list) ? list : []; }
  function saveFriends(list) { store.setJson("qpc_friends_list", list); }
  function isFriend(id) { return getFriends().some((f) => f.personalId === id); }
  function addFriend(id, name) {
    const code = String(id || "").trim().toUpperCase();
    if (!code) return false;
    const list = getFriends();
    if (list.some((f) => f.personalId === code)) return false;
    list.push({ personalId: code, name: sanitize(name, 20) || "Friend" });
    saveFriends(list);
    return true;
  }

  function renderFriendsList() {
    const ul = $("#friends-list-ul");
    if (!ul) return;
    ul.innerHTML = "";
    const friends = getFriends();
    const tab = $("#tab-friends");
    if (tab) tab.innerHTML = '<i class="fa-solid fa-user-group" aria-hidden="true"></i> Friends' + (friends.length ? " · " + friends.length : "");
    if (!friends.length) {
      const li = document.createElement("li");
      li.className = "empty-note";
      li.textContent = "No friends yet. Share your call code, or add someone from a room's People list.";
      ul.appendChild(li);
      return;
    }
    friends.forEach((f) => {
      const li = document.createElement("li");
      li.className = "friend-item";
      li.appendChild(makeAvatar(f.name, f.personalId));
      const who = document.createElement("div"); who.className = "who";
      const n = document.createElement("strong"); n.textContent = f.name;
      const c = document.createElement("span"); c.textContent = f.personalId;
      who.appendChild(n); who.appendChild(c);
      const chat = document.createElement("button");
      chat.type = "button"; chat.className = "btn btn-soft btn-sm";
      chat.innerHTML = '<i class="fa-solid fa-message" aria-hidden="true"></i> Chat';
      chat.addEventListener("click", () => connectToFriend(f.personalId, f.name, chat));
      const del = document.createElement("button");
      del.type = "button"; del.className = "icon-btn icon-btn-sm"; del.title = "Remove " + f.name; del.setAttribute("aria-label", "Remove " + f.name);
      del.innerHTML = '<i class="fa-regular fa-trash-can" aria-hidden="true"></i>';
      del.addEventListener("click", async () => {
        if (await confirmDialog("Remove " + f.name + "?", "You can add them again later with their call code.", "Remove")) {
          saveFriends(getFriends().filter((x) => x.personalId !== f.personalId));
          renderFriendsList();
        }
      });
      li.appendChild(who); li.appendChild(chat); li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function initFriends() {
    const display = $("#my-persistent-id-display");
    if (display) display.textContent = myPersonalId;
    $("#btn-copy-my-code")?.addEventListener("click", () => copyText(myPersonalId, "Call code copied"));
    $("#btn-reset-my-code")?.addEventListener("click", async () => {
      if (!(await confirmDialog("Get a new call code?", "Your current code stops working. Friends will need the new one to reach you.", "Get new code"))) return;
      myPersonalId = "QPC-" + randomCode(8);
      store.set("qpc_personal_id", myPersonalId);
      if (display) display.textContent = myPersonalId;
      toast("New call code: " + myPersonalId, "fa-solid fa-arrows-rotate");
      initPersonalPeer();
    });
    const codeInput = $("#add-friend-code-input"), nameInput = $("#add-friend-name-input");
    codeInput?.addEventListener("input", () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16); });
    $("#btn-add-friend-manual")?.addEventListener("click", () => {
      const code = codeInput.value.trim().toUpperCase();
      const name = sanitize(nameInput.value, 20);
      if (!/^QPC-[A-Z0-9]{3,16}$/.test(code)) { setEntryStatus("A call code looks like QPC-ABCD2345."); codeInput.focus(); return; }
      if (!name) { setEntryStatus("Give your friend a nickname."); nameInput.focus(); return; }
      if (code === myPersonalId) { setEntryStatus("That's your own call code."); return; }
      if (!addFriend(code, name)) { setEntryStatus(name + " is already in your friends.", "warning"); return; }
      codeInput.value = ""; nameInput.value = "";
      setEntryStatus("");
      toast(name + " added to friends", "fa-solid fa-user-check");
      renderFriendsList();
    });
    el.btnAcceptDirect?.addEventListener("click", acceptDirect);
    el.btnDeclineDirect?.addEventListener("click", declineDirect);
    renderFriendsList();
  }

  /* ============================================================
     MESSAGES UI
     ============================================================ */
  function addSystemMessage(text, kind) {
    if (!el.messages) return;
    el.messages.querySelector(".empty-chat")?.remove();
    const div = document.createElement("div");
    div.className = "system-msg" + (kind === "warn" ? " warn" : "");
    div.textContent = text;
    const t = document.createElement("span"); t.className = "msg-time"; t.textContent = " · " + formatTime();
    div.appendChild(t);
    el.messages.appendChild(div);
    lastRow = null;
    afterAppend(false);
  }

  function addChatMessage({ sender, senderId, text, own, msgId, time }) {
    if (!el.messages) return;
    el.messages.querySelector(".empty-chat")?.remove();
    const grouped = lastRow && lastRow.senderId === senderId && (time - lastRow.time) < 3 * 60 * 1000;
    const row = document.createElement("div");
    row.className = "msg-row" + (own ? " own" : "") + (grouped ? " grouped" : "");
    row.appendChild(makeAvatar(sender, senderId));

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    const nameEl = document.createElement("span"); nameEl.className = "msg-sender"; nameEl.textContent = sender;
    nameEl.style.color = "hsl(" + hueFor(senderId) + " 60% " + (document.documentElement.dataset.theme === "dark" ? "72%" : "42%") + ")";
    const textEl = document.createElement("span"); textEl.className = "msg-text"; textEl.textContent = text;
    const meta = document.createElement("span"); meta.className = "msg-meta";
    const t = document.createElement("span"); t.className = "msg-time"; t.textContent = formatTime(time);
    meta.appendChild(t);
    if (own && msgId) {
      const tick = document.createElement("span");
      tick.className = "msg-ticks"; tick.title = "Sent";
      tick.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
      meta.appendChild(tick);
      tickEls.set(String(msgId), tick);
    }
    bubble.appendChild(nameEl); bubble.appendChild(textEl); bubble.appendChild(meta);
    row.appendChild(bubble);
    el.messages.appendChild(row);
    lastRow = { senderId, time };
    if (searchQuery) applySearchTo(bubble);
    afterAppend(own);
  }

  function afterAppend(forceScroll) {
    const c = el.messages;
    const distance = c.scrollHeight - c.scrollTop - c.clientHeight;
    if (forceScroll || distance < 160) {
      c.scrollTop = c.scrollHeight;
      scrollUnread = 0; updateUnread();
    } else {
      scrollUnread++; updateUnread();
      el.scrollBtn.classList.remove("hidden");
    }
  }
  function updateUnread() {
    el.unread.textContent = scrollUnread > 0 ? String(scrollUnread) : "";
    el.unread.classList.toggle("hidden", scrollUnread === 0);
  }
  function initScroll() {
    el.messages.addEventListener("scroll", () => {
      const c = el.messages;
      const far = c.scrollHeight - c.scrollTop - c.clientHeight > 160;
      el.scrollBtn.classList.toggle("hidden", !far);
      if (!far) { scrollUnread = 0; updateUnread(); }
    });
    el.scrollBtn.addEventListener("click", () => {
      el.messages.scrollTo({ top: el.messages.scrollHeight, behavior: "smooth" });
      scrollUnread = 0; updateUnread();
    });
  }

  function resetComposer() {
    el.input.disabled = false;
    el.input.value = "";
    el.input.placeholder = "Message";
    autoSize();
    el.send.disabled = true;
  }

  function autoSize() {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 140) + "px";
  }

  function sendMessage() {
    if (!session || el.input.disabled) return;
    const text = sanitizeMessage(el.input.value);
    if (!text) return;
    const now = Date.now();
    if (now - lastMessageAt < 400 && text === lastMessageText) return; // ignore accidental double-send
    lastMessageAt = now; lastMessageText = text;
    const msgId = eventId();
    addChatMessage({ sender: myName, senderId: myPeerId, text, own: true, msgId, time: now });
    broadcast({ type: "message", name: myName, text, msgId, time: now });
    el.input.value = "";
    autoSize();
    el.send.disabled = true;
    stopTyping();
    const reachable = Array.from(connections.values()).some((c) => c && c.open);
    if (members.size <= 1) addSystemMessage(session === "direct" ? "Your friend isn't connected, so this wasn't delivered." : "Nobody else is in the room yet, so nobody received that.", "warn");
    else if (!reachable) addSystemMessage("You're not connected right now, so this may not have been delivered.", "warn");
  }

  /* ---------- Typing ---------- */
  function onTypingInput() {
    autoSize();
    el.send.disabled = !el.input.value.trim();
    const now = Date.now();
    if (now - typingSentAt > 2000) { typingSentAt = now; sendAll({ type: "typing", isTyping: true }); }
    clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(stopTyping, 3000);
  }
  function stopTyping() {
    clearTimeout(typingStopTimer);
    if (typingSentAt) { sendAll({ type: "typing", isTyping: false }); typingSentAt = 0; }
  }
  function onTyping(senderId, data) {
    if (!members.has(senderId)) return;
    clearTyping(senderId, true);
    if (data.isTyping) {
      const timer = setTimeout(() => clearTyping(senderId), 4500);
      typingPeople.set(senderId, { name: memberName(senderId), timer });
    }
    renderTyping();
  }
  function clearTyping(peerId, quiet) {
    const t = typingPeople.get(peerId);
    if (t) { clearTimeout(t.timer); typingPeople.delete(peerId); }
    if (!quiet) renderTyping();
  }
  function clearAllTyping() { typingPeople.forEach((t) => clearTimeout(t.timer)); typingPeople.clear(); renderTyping(); }
  function renderTyping() {
    const names = Array.from(typingPeople.values()).map((t) => t.name);
    el.typing.innerHTML = "";
    if (!names.length) return;
    const strong = document.createElement("strong");
    strong.textContent = names.length === 1 ? names[0] : names.length === 2 ? names.join(" and ") : "Several people";
    el.typing.appendChild(strong);
    el.typing.appendChild(document.createTextNode(names.length === 1 ? " is typing" : " are typing"));
    const dots = document.createElement("span"); dots.className = "typing-dots"; dots.innerHTML = "<span>.</span><span>.</span><span>.</span>";
    el.typing.appendChild(dots);
  }

  /* ---------- Heartbeat / presence ---------- */
  function startHeartbeat() {
    stopHeartbeat();
    lastHeartbeats.set(myPeerId, Date.now());
    heartbeatTimer = setInterval(() => {
      if (!session) return;
      sendAll({ type: "heartbeat" });
      lastHeartbeats.set(myPeerId, Date.now());
    }, 8000);
    presenceTimer = setInterval(() => { if (session) refreshPresence(); }, 5000);
  }
  function stopHeartbeat() {
    clearInterval(heartbeatTimer); clearInterval(presenceTimer);
    heartbeatTimer = presenceTimer = null;
    lastHeartbeats.clear();
  }
  function presenceClass(peerId) {
    if (peerId === myPeerId) return "status-online";
    const direct = connections.get(peerId)?.open;
    const last = lastHeartbeats.get(peerId) || 0;
    if (direct) return Date.now() - last <= 30000 ? "status-online" : "status-away";
    // No direct link (e.g. a strict network): still in the room through the host.
    return session === "room" ? "status-away" : "status-offline";
  }
  function presenceTitle(cls, peerId) {
    if (cls === "status-online") return "Online";
    if (cls === "status-away") return connections.get(peerId)?.open ? "Not responding" : "Connected through the host";
    return "Offline";
  }
  function refreshPresence() {
    el.members.querySelectorAll(".member").forEach((li) => {
      const dot = li.querySelector(".presence");
      if (!dot) return;
      const cls = presenceClass(li.dataset.peerId);
      dot.className = "presence " + cls;
      dot.title = presenceTitle(cls, li.dataset.peerId);
    });
  }

  function updateMembersUI() {
    if (!el.members) return;
    el.members.innerHTML = "";
    const ordered = Array.from(members.entries()).sort((a, b) => (a[1].role === "Host" ? -1 : b[1].role === "Host" ? 1 : 0));
    ordered.forEach(([id, m]) => {
      const li = document.createElement("li");
      li.className = "member";
      li.dataset.peerId = id;
      const wrap = document.createElement("span"); wrap.className = "avatar-wrap";
      wrap.appendChild(makeAvatar(m.name, m.personalId || id));
      const dot = document.createElement("span"); const pc = presenceClass(id); dot.className = "presence " + pc; dot.title = presenceTitle(pc, id);
      wrap.appendChild(dot);
      const who = document.createElement("div"); who.className = "who";
      const n = document.createElement("strong"); n.textContent = m.name + (id === myPeerId ? " (you)" : "");
      const r = document.createElement("span");
      const inThisCall = (id === myPeerId && inCall) || callParticipants.has(id);
      r.textContent = (session === "direct" ? (id === myPeerId ? "You" : "Friend") : m.role);
      if (inThisCall) { const c = document.createElement("span"); c.className = "tag-call"; c.textContent = " · in call"; r.appendChild(c); }
      who.appendChild(n); who.appendChild(r);
      li.appendChild(wrap); li.appendChild(who);

      const pid = m.personalId || id;
      if (id !== myPeerId && /^QPC-/.test(pid) && pid !== myPersonalId) {
        const add = document.createElement("button");
        add.type = "button"; add.className = "add-friend-btn-small";
        const already = isFriend(pid);
        add.disabled = already;
        add.title = already ? m.name + " is in your friends" : "Add " + m.name + " to friends";
        add.setAttribute("aria-label", add.title);
        add.innerHTML = already ? '<i class="fa-solid fa-user-check" aria-hidden="true"></i>' : '<i class="fa-solid fa-user-plus" aria-hidden="true"></i>';
        add.addEventListener("click", () => {
          if (addFriend(pid, m.name)) { toast(m.name + " added to friends", "fa-solid fa-user-check"); updateMembersUI(); renderFriendsList(); }
        });
        li.appendChild(add);
      }
      el.members.appendChild(li);
    });
    el.memberCount.textContent = String(members.size);
    if (el.capacity) el.capacity.textContent = session === "room" ? members.size + " of " + roomMaxMembers + " people" : "";
    if (session) setConnectionStatus(statusLabel(), session === "direct" && !members.has(directPartner) ? "offline" : session === "direct" && !connections.get(directPartner)?.open ? "ready" : "connected");
    updateCallButtons();
  }

  /* ============================================================
     CALLS (mesh: every participant calls those already in the call)
     ============================================================ */
  function updateCallButtons() {
    const others = members.size > 1;
    const remoteCall = !inCall && callParticipants.size > 0;
    el.btnVoice.classList.toggle("hidden", inCall || remoteCall);
    el.btnVideo.classList.toggle("hidden", inCall || remoteCall);
    el.btnVoice.disabled = el.btnVideo.disabled = !others;
    el.btnVoice.title = others ? "Start voice call" : "Waiting for someone to join";
    el.btnVideo.title = others ? "Start video call" : "Waiting for someone to join";
    el.btnJoinCall.classList.toggle("hidden", !remoteCall);
    if (remoteCall) {
      el.btnJoinCall.innerHTML = '<i class="fa-solid ' + (callMediaType === "video" ? "fa-video" : "fa-phone") + '" aria-hidden="true"></i> <span>Join call</span><span class="join-count"> · ' + callParticipants.size + "</span>";
      el.btnJoinCall.title = callParticipants.size + (callParticipants.size === 1 ? " person" : " people") + " in the " + callMediaType + " call";
    }
  }

  async function getMedia(type) {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: type === "video" ? { width: { ideal: 640 }, height: { ideal: 480 } } : false });
    } catch (err) {
      if (type === "video" && (err.name === "NotFoundError" || err.name === "NotReadableError")) {
        toast("No camera available. Joining with audio only.", "fa-solid fa-video-slash", 3500);
        return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      throw err;
    }
  }

  function mediaErrorText(err) {
    if (err?.name === "NotAllowedError" || err?.name === "SecurityError") return "Microphone or camera permission was blocked. Allow it in your browser's site settings and try again.";
    if (err?.name === "NotFoundError") return "No microphone was found on this device.";
    if (err?.name === "NotSupportedError") return "Calls need a secure (https) page in a modern browser.";
    return "Couldn't start your microphone or camera.";
  }

  let callStarting = false;
  async function startCall(type) {
    if (inCall || callStarting || members.size <= 1) return;
    callStarting = true;
    try { localStream = await getMedia(type); }
    catch (err) { toast(mediaErrorText(err), "fa-solid fa-triangle-exclamation", 4500); return; }
    finally { callStarting = false; }
    if (!session || callParticipants.size) {
      // Left the room, or someone else started a call while we were waiting for permission.
      if (session && callParticipants.size) { const s2 = localStream; localStream = null; s2.getTracks().forEach((t) => t.stop()); return joinCall(callMediaType); }
      localStream.getTracks().forEach((t) => t.stop()); localStream = null; return;
    }
    inCall = true; callDeclined = false;
    callMediaType = type;
    callParticipants.clear();
    showCallUI();
    broadcast({ type: "call-started", mediaType: type, name: myName });
    addSystemMessage("You started a " + type + " call. Others can join from their screen.");
    updateMembersUI();
  }

  async function joinCall(type) {
    if (inCall || callStarting) return;
    hideIncoming();
    callStarting = true;
    try { localStream = await getMedia(type || callMediaType); }
    catch (err) { toast(mediaErrorText(err), "fa-solid fa-triangle-exclamation", 4500); return; }
    finally { callStarting = false; }
    if (!session || !callParticipants.size) {
      localStream.getTracks().forEach((t) => t.stop()); localStream = null;
      if (session) toast("That call has already ended.", "fa-solid fa-circle-info");
      return;
    }
    inCall = true; callDeclined = false;
    showCallUI();
    broadcast({ type: "call-joined", mediaType: callMediaType, name: myName });
    callParticipants.forEach((id) => placeCall(id));
    updateMembersUI();
  }

  function placeCall(peerId) {
    if (!peer || !localStream || activeCalls.has(peerId) || peerId === myPeerId) return;
    try {
      const call = peer.call(peerId, localStream, { metadata: { callerName: myName, mediaType: callMediaType, v: APP_VERSION } });
      addTile(peerId, null);
      wireMediaCall(call);
    } catch (e) { console.warn("[QPC] call failed", e); }
  }

  function onIncomingMedia(call) {
    if (inCall && localStream && members.has(call.peer)) {
      if (activeCalls.has(call.peer)) {
        // Both sides dialled at once: keep the call placed by the lower id.
        if (myPeerId < call.peer) { try { call.close(); } catch (e) {} return; }
        const old = activeCalls.get(call.peer); activeCalls.delete(call.peer); try { old.close(); } catch (e) {}
      }
      callParticipants.add(call.peer);
      call.answer(localStream);
      addTile(call.peer, null);
      wireMediaCall(call);
      updateMembersUI();
      return;
    }
    // Not in a call (or unknown peer): reject quietly.
    try { call.close(); } catch (e) {}
  }

  function wireMediaCall(call) {
    activeCalls.set(call.peer, call);
    call.on("stream", (stream) => {
      if (activeCalls.get(call.peer) !== call) return;
      addTile(call.peer, stream);
      if (isMicMuted || isCamOff) sendTo(call.peer, { type: "media-state", muted: isMicMuted, camOff: isCamOff });
    });
    const gone = () => {
      if (activeCalls.get(call.peer) !== call) return;
      activeCalls.delete(call.peer);
      removeTile(call.peer);
    };
    call.on("close", gone);
    call.on("error", gone);
  }

  function onCallStarted(origin, data) {
    if (origin === myPeerId || !members.has(origin)) return;
    callMediaType = data.mediaType === "video" ? "video" : "voice";
    callParticipants.add(origin);
    callDeclined = false;
    updateMembersUI();
    if (inCall) { if (myPeerId < origin) placeCall(origin); return; }
    addSystemMessage(memberName(origin, data.name) + " started a " + callMediaType + " call.");
    showIncoming(origin, data.name);
  }

  function onCallState(senderId, data) {
    if (!Array.isArray(data.participants)) return;
    data.participants.forEach((id) => { if (id && id !== myPeerId && members.has(id)) callParticipants.add(id); });
    if (data.participants.length) callMediaType = data.mediaType === "video" ? "video" : "voice";
    updateMembersUI();
  }

  function onCallJoined(origin, data) {
    if (origin === myPeerId || !members.has(origin)) return;
    callParticipants.add(origin);
    if (!inCall) { if (data.mediaType) callMediaType = data.mediaType === "video" ? "video" : "voice"; }
    else addSystemMessage(memberName(origin, data.name) + " joined the call.");
    updateMembersUI();
  }

  function onCallLeft(origin, data) {
    if (origin === myPeerId) return;
    const was = callParticipants.has(origin);
    removeFromCall(origin);
    if (inCall && was) addSystemMessage(memberName(origin, data.name) + " left the call.");
    updateMembersUI();
  }

  function removeFromCall(peerId) {
    const wasIn = callParticipants.has(peerId);
    callParticipants.delete(peerId);
    const call = activeCalls.get(peerId);
    if (call) { activeCalls.delete(peerId); try { call.close(); } catch (e) {} }
    removeTile(peerId);
    if (pendingInvite && pendingInvite.from === peerId && !callParticipants.size) hideIncoming(true);
    if (inCall && wasIn && callParticipants.size === 0) {
      addSystemMessage("Everyone else left, so the call ended.");
      leaveCall(false);
    }
  }

  function leaveCall(notify = true) {
    if (!inCall) { endCallUI(); return; }
    inCall = false;
    if (notify) { broadcast({ type: "call-left", name: myName }); addSystemMessage("You left the call."); }
    activeCalls.forEach((c) => { try { c.close(); } catch (e) {} });
    activeCalls.clear();
    endCallUI();
    if (!notify) callParticipants.clear();
    updateMembersUI();
  }

  function showIncoming(from, name) {
    if (callDeclined) return;
    pendingInvite = { from, name: memberName(from, name) };
    el.callerName.textContent = pendingInvite.name;
    el.callerDetail.textContent = "started a " + callMediaType + " call";
    setAvatar(el.callerAvatar, pendingInvite.name, members.get(from)?.personalId || from);
    el.btnAccept.innerHTML = '<i class="fa-solid ' + (callMediaType === "video" ? "fa-video" : "fa-phone") + '" aria-hidden="true"></i> Join';
    openModal(el.incoming);
    ringStart();
  }
  function hideIncoming(missed) {
    if (pendingInvite && missed) addSystemMessage("Missed call from " + pendingInvite.name + ".");
    pendingInvite = null;
    closeModal(el.incoming);
    ringStop();
  }

  let ringTimer = null, ringLimit = null, missTimer = null;
  function ringStart() {
    ringStop();
    playTone([600, 800, 1000], 0.14);
    ringTimer = setInterval(() => playTone([600, 800, 1000], 0.14), 2200);
    ringLimit = setTimeout(ringStop, 30000);
    missTimer = setTimeout(() => { if (pendingInvite) { hideIncoming(true); callDeclined = true; updateCallButtons(); } }, 45000);
  }
  function ringStop() { clearInterval(ringTimer); clearTimeout(ringLimit); clearTimeout(missTimer); ringTimer = ringLimit = missTimer = null; }

  function showCallUI() {
    el.callStage.classList.remove("hidden");
    el.callStage.classList.toggle("voice", callMediaType !== "video");
    el.callLabel.textContent = callMediaType === "video" ? "Video call" : "Voice call";
    const hasVideo = !!localStream?.getVideoTracks().length;
    el.ctrlCam.classList.toggle("hidden", !hasVideo);
    isMicMuted = false; isCamOff = false; syncControls();
    addTile("me", localStream);
    document.body.classList.add("qpc-call-active");
    updateCallButtons();
  }

  function endCallUI() {
    if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null; }
    el.tiles.innerHTML = "";
    el.callStage.classList.add("hidden");
    document.body.classList.remove("qpc-call-active");
    isMicMuted = false; isCamOff = false;
    syncControls();
    updateCallButtons();
  }

  function addTile(peerId, stream) {
    let tile = el.tiles.querySelector('[data-peer-id="' + CSS.escape(peerId) + '"]');
    const isMe = peerId === "me";
    const name = isMe ? myName + " (you)" : memberName(peerId);
    if (!tile) {
      tile = document.createElement("div");
      tile.className = "tile connecting";
      tile.dataset.peerId = peerId;
      tile.appendChild(makeAvatar(isMe ? myName : name, isMe ? myPersonalId : (members.get(peerId)?.personalId || peerId)));
      const label = document.createElement("span"); label.className = "tile-label";
      const nm = document.createElement("span"); nm.textContent = name; label.appendChild(nm);
      tile.appendChild(label);
      if (isMe) el.tiles.prepend(tile); else el.tiles.appendChild(tile);
    }
    if (!stream) return;
    tile.classList.remove("connecting");
    let media = tile.querySelector("video");
    if (!media) {
      media = document.createElement("video");
      media.autoplay = true; media.playsInline = true;
      if (isMe) media.muted = true;
      tile.prepend(media);
    }
    if (media.srcObject !== stream) media.srcObject = stream;
    const playP = media.play && media.play(); if (playP && playP.catch) playP.catch(() => {});
    const hasVideo = stream.getVideoTracks().some((t) => t.readyState === "live");
    tile.classList.toggle("has-video", hasVideo);
    media.style.display = hasVideo ? "" : "none";
    if (!isMe && remoteMedia.has(peerId)) applyRemoteMedia(peerId);
  }

  function removeTile(peerId) {
    remoteMedia.delete(peerId);
    const tile = el.tiles.querySelector('[data-peer-id="' + CSS.escape(peerId) + '"]');
    if (tile) { const v = tile.querySelector("video"); if (v) v.srcObject = null; tile.remove(); }
  }

  const remoteMedia = new Map(); // peerId -> { muted, camOff }
  function sendMediaState() { if (inCall) sendAll({ type: "media-state", muted: isMicMuted, camOff: isCamOff }); }
  function applyRemoteMedia(peerId) {
    const st = remoteMedia.get(peerId) || {};
    const tile = el.tiles.querySelector('[data-peer-id="' + CSS.escape(peerId) + '"]');
    if (!tile) return;
    tile.classList.toggle("cam-off", !!st.camOff);
    const label = tile.querySelector(".tile-label");
    label?.querySelector(".fa-microphone-slash")?.remove();
    if (st.muted && label) label.prepend(icon("fa-solid fa-microphone-slash"));
  }
  function toggleMic() {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    isMicMuted = !track.enabled;
    syncControls();
    sendMediaState();
  }
  function toggleCam() {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    isCamOff = !track.enabled;
    syncControls();
    sendMediaState();
  }
  function syncControls() {
    el.ctrlMic.setAttribute("aria-pressed", String(isMicMuted));
    el.ctrlMic.innerHTML = '<i class="fa-solid ' + (isMicMuted ? "fa-microphone-slash" : "fa-microphone") + '" aria-hidden="true"></i>';
    el.ctrlMic.setAttribute("aria-label", isMicMuted ? "Unmute microphone" : "Mute microphone");
    el.ctrlCam.setAttribute("aria-pressed", String(isCamOff));
    el.ctrlCam.innerHTML = '<i class="fa-solid ' + (isCamOff ? "fa-video-slash" : "fa-video") + '" aria-hidden="true"></i>';
    el.ctrlCam.setAttribute("aria-label", isCamOff ? "Turn camera on" : "Turn camera off");
    const me = el.tiles.querySelector('[data-peer-id="me"]');
    if (me) {
      me.classList.toggle("cam-off", isCamOff);
      const label = me.querySelector(".tile-label");
      label?.querySelector(".fa-microphone-slash")?.remove();
      if (isMicMuted && label) label.prepend(icon("fa-solid fa-microphone-slash"));
    }
  }

  /* ============================================================
     SOUND / NOTIFICATIONS / TITLE
     ============================================================ */
  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    } catch (e) {}
  }
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, unlockAudio, { once: true, passive: true }));
  function playTone(freqs, len) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      const now = audioCtx.currentTime;
      freqs.forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(f, now + i * len);
        g.gain.setValueAtTime(0.14, now + i * len);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * len + len * 0.95);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(now + i * len); o.stop(now + i * len + len);
      });
    } catch (e) {}
  }
  function askNotifications() {
    notificationAsked = true;
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch (e) {}
  }
  function showNotification(name, text) {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
      const n = new Notification(name, { body: text.slice(0, 120), tag: "qpc-msg", icon: "/icons/icon-192.png" });
      n.onclick = () => { window.focus(); n.close(); };
      setTimeout(() => { try { n.close(); } catch (e) {} }, 6000);
    } catch (e) {}
  }
  function updateTitleBadge() {
    document.title = unreadTitleCount > 0 && session ? "(" + unreadTitleCount + ") " + (session === "room" ? "Room " + roomCode : "Direct chat") + " · Quick Private Chat" : originalTitle;
  }

  /* ============================================================
     SEARCH
     ============================================================ */
  let searchQuery = "";
  function openSearch() { el.searchBar.classList.add("visible"); el.btnSearch.classList.add("active"); el.searchInput.focus(); el.searchInput.select(); }
  function closeSearch() {
    el.searchBar.classList.remove("visible"); el.btnSearch.classList.remove("active");
    el.searchInput.value = ""; searchQuery = "";
    $$(".message-bubble").forEach(clearSearchFrom);
    el.searchCount.textContent = "";
  }
  function clearSearchFrom(bubble) {
    bubble.classList.remove("search-hit", "search-dim");
    const t = bubble.querySelector(".msg-text");
    if (t && t.dataset.raw !== undefined) { t.textContent = t.dataset.raw; delete t.dataset.raw; }
  }
  function applySearchTo(bubble) {
    clearSearchFrom(bubble);
    if (!searchQuery) return false;
    const t = bubble.querySelector(".msg-text");
    const raw = t.textContent;
    const idx = raw.toLowerCase().indexOf(searchQuery);
    if (idx < 0) { bubble.classList.add("search-dim"); return false; }
    t.dataset.raw = raw;
    t.textContent = "";
    let pos = 0, i = idx;
    const low = raw.toLowerCase();
    while (i >= 0) {
      t.appendChild(document.createTextNode(raw.slice(pos, i)));
      const mark = document.createElement("mark"); mark.textContent = raw.slice(i, i + searchQuery.length); t.appendChild(mark);
      pos = i + searchQuery.length; i = low.indexOf(searchQuery, pos);
    }
    t.appendChild(document.createTextNode(raw.slice(pos)));
    bubble.classList.add("search-hit");
    return true;
  }
  function performSearch() {
    searchQuery = el.searchInput.value.trim().toLowerCase();
    let hits = 0, first = null;
    $$(".message-bubble").forEach((b) => { if (applySearchTo(b)) { hits++; first = first || b; } });
    if (!searchQuery) { $$(".message-bubble").forEach(clearSearchFrom); el.searchCount.textContent = ""; return; }
    el.searchCount.textContent = hits === 1 ? "1 match" : hits + " matches";
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /* ============================================================
     EMOJI
     ============================================================ */
  const EMOJI = {
    smileys: "😀 😃 😄 😁 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😎 🤩 🥳 😏 😢 😭 😡 🤬 😱 🤔 🤫 😴 🥵 😷 🤕 🤑 🤠 😈 🙃".split(" "),
    gestures: "👍 👎 👋 🤝 🙏 👏 🤞 ✌️ 🤙 💪 🙌 🫶 👌 🤌 👀 🫡".split(" "),
    hearts: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💖 💕 💯".split(" "),
    activities: "🎉 🎊 🎂 🎁 🎮 🏆 🥇 🎸 🎬 ⚽ 🏀 🎵".split(" "),
    food: "🍕 🍔 🍟 ☕ 🍺 🍰 🍿 🥪 🍣 🍜 🍩 🥂".split(" "),
    travel: "🌍 ✈️ 🚗 🏠 🌅 🏖️ 🏕️ 🌙 ☀️ 🌧️ ❄️ 🚀".split(" "),
    symbols: "✅ ❌ ✨ 🔥 💬 🔒 ⚠️ 💡 🔔 📌 🎯 💎".split(" ")
  };
  const EMOJI_TABS = [["recent", "🕒"], ["smileys", "😀"], ["gestures", "👋"], ["hearts", "❤️"], ["activities", "🎉"], ["food", "🍕"], ["travel", "🌍"], ["symbols", "✨"]];

  function initEmoji() {
    const tabs = el.emojiPicker.querySelector(".emoji-tabs");
    const grid = el.emojiPicker.querySelector(".emoji-grid");
    const show = (cat) => {
      tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
      grid.innerHTML = "";
      const list = cat === "recent" ? store.json("qpc_recent_emojis", []) : EMOJI[cat];
      if (!list.length) { const n = document.createElement("div"); n.className = "empty-note"; n.textContent = "Emoji you use will appear here."; grid.appendChild(n); return; }
      list.forEach((e) => { const b = document.createElement("button"); b.type = "button"; b.textContent = e; b.setAttribute("aria-label", e); grid.appendChild(b); });
    };
    EMOJI_TABS.forEach(([cat, sym]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "emoji-tab-btn"; b.dataset.cat = cat; b.textContent = sym; b.setAttribute("aria-label", cat);
      b.addEventListener("click", (e) => { e.stopPropagation(); show(cat); });
      tabs.appendChild(b);
    });
    show(store.json("qpc_recent_emojis", []).length ? "recent" : "smileys");

    grid.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const emoji = b.textContent;
      const s = el.input.selectionStart ?? el.input.value.length, en = el.input.selectionEnd ?? el.input.value.length;
      el.input.value = el.input.value.slice(0, s) + emoji + el.input.value.slice(en);
      el.input.focus();
      el.input.selectionStart = el.input.selectionEnd = s + emoji.length;
      let recent = store.json("qpc_recent_emojis", []).filter((x) => x !== emoji);
      recent.unshift(emoji); store.setJson("qpc_recent_emojis", recent.slice(0, 16));
      onTypingInput();
    });
    el.emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = el.emojiPicker.classList.toggle("hidden") === false;
      el.emojiBtn.setAttribute("aria-expanded", String(open));
      if (open) show(tabs.querySelector(".active")?.dataset.cat || "smileys");
    });
    document.addEventListener("click", (e) => {
      if (!el.emojiPicker.classList.contains("hidden") && !el.emojiPicker.contains(e.target) && !el.emojiBtn.contains(e.target)) {
        el.emojiPicker.classList.add("hidden"); el.emojiBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ============================================================
     CONTEXT MENU (copy message)
     ============================================================ */
  let ctxText = "";
  function showCtx(x, y, text) {
    ctxText = text;
    el.ctxMenu.classList.add("visible");
    const r = el.ctxMenu.getBoundingClientRect();
    el.ctxMenu.style.left = Math.min(x, window.innerWidth - r.width - 8) + "px";
    el.ctxMenu.style.top = Math.min(y, window.innerHeight - r.height - 8) + "px";
  }
  function hideCtx() { el.ctxMenu.classList.remove("visible"); }
  function initContextMenu() {
    const textOf = (b) => { const t = b.querySelector(".msg-text"); return t ? (t.dataset.raw ?? t.textContent) : ""; };
    el.messages.addEventListener("contextmenu", (e) => {
      const b = e.target.closest(".message-bubble"); if (!b) return;
      e.preventDefault(); showCtx(e.clientX, e.clientY, textOf(b));
    });
    let pressTimer = null, start = null;
    el.messages.addEventListener("touchstart", (e) => {
      const b = e.target.closest(".message-bubble"); if (!b) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pressTimer = setTimeout(() => { showCtx(start.x, start.y, textOf(b)); try { navigator.vibrate && navigator.vibrate(30); } catch (err) {} }, 550);
    }, { passive: true });
    el.messages.addEventListener("touchmove", (e) => { if (start && (Math.abs(e.touches[0].clientX - start.x) > 10 || Math.abs(e.touches[0].clientY - start.y) > 10)) clearTimeout(pressTimer); }, { passive: true });
    el.messages.addEventListener("touchend", () => clearTimeout(pressTimer));
    el.ctxCopy.addEventListener("click", () => { hideCtx(); copyText(ctxText, "Message copied"); });
    document.addEventListener("click", (e) => { if (!el.ctxMenu.contains(e.target)) hideCtx(); });
    el.messages.addEventListener("scroll", hideCtx, { passive: true });
  }

  /* ============================================================
     SIDEBAR / COPY / KEYBOARD
     ============================================================ */
  function openSidebar() { el.sidebar.classList.add("active"); }
  function closeSidebar() { el.sidebar.classList.remove("active"); }

  function copyInviteLink() {
    if (!roomCode) return;
    const url = new URL(window.location.href);
    url.search = ""; url.hash = "";
    url.searchParams.set("room", roomCode);
    copyText(url.toString(), "Invite link copied. Share it only with people you know.");
  }

  function initKeyboard() {
    document.addEventListener("keydown", (e) => {
      const inChat = el.chat.classList.contains("active");
      if (e.key === "Escape") {
        hideCtx();
        if (!el.emojiPicker.classList.contains("hidden")) { el.emojiPicker.classList.add("hidden"); return; }
        if (el.searchBar.classList.contains("visible")) { closeSearch(); return; }
        ["#report-modal", "#legal-guide-modal", "#install-help-modal"].forEach((s) => closeModal($(s)));
        closeSidebar();
        return;
      }
      if (!inChat) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); openSearch(); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && inCall) {
        const k = e.key.toLowerCase();
        if (k === "m") { e.preventDefault(); toggleMic(); }
        if (k === "v") { e.preventDefault(); toggleCam(); }
        if (k === "e") { e.preventDefault(); leaveCall(true); }
      }
    });
  }

  function bindChat() {
    el.btnLeave.addEventListener("click", leaveRoom);
    el.send.addEventListener("click", sendMessage);
    el.input.addEventListener("input", onTypingInput);
    el.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
    });
    el.btnMenu.addEventListener("click", openSidebar);
    el.btnCloseSidebar.addEventListener("click", closeSidebar);
    el.scrim.addEventListener("click", closeSidebar);
    el.copyCode.addEventListener("click", () => roomCode && copyText(roomCode, "Room code copied"));
    el.copyInvite.addEventListener("click", copyInviteLink);
    el.btnVoice.addEventListener("click", () => startCall("voice"));
    el.btnVideo.addEventListener("click", () => startCall("video"));
    el.btnJoinCall.addEventListener("click", () => joinCall(callMediaType));
    el.btnAccept.addEventListener("click", () => joinCall(callMediaType));
    el.btnDecline.addEventListener("click", () => {
      const from = pendingInvite?.from;
      callDeclined = true;
      hideIncoming(false);
      if (from) broadcast({ type: "call-declined", name: myName });
      addSystemMessage("You declined the call. You can still join from the header.");
      updateCallButtons();
    });
    el.ctrlMic.addEventListener("click", toggleMic);
    el.ctrlCam.addEventListener("click", toggleCam);
    el.ctrlEnd.addEventListener("click", () => leaveCall(true));
    el.btnSearch.addEventListener("click", () => (el.searchBar.classList.contains("visible") ? closeSearch() : openSearch()));
    el.btnCloseSearch.addEventListener("click", closeSearch);
    let searchTimer = null;
    el.searchInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(performSearch, 150); });
    el.searchInput.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSearch(); });

    document.addEventListener("visibilitychange", () => { if (!document.hidden) { unreadTitleCount = 0; updateTitleBadge(); } });
    window.addEventListener("pagehide", () => {
      if (!session) return;
      isUserLeaving = true;
      try {
        if (inCall) sendAll({ type: "call-left", eid: eventId(), from: myPeerId, name: myName });
        if (session === "room" && isHost) sendAll({ type: "room-closed", eid: eventId(), from: myPeerId, name: myName });
        else sendAll({ type: "member-left", id: myPeerId });
      } catch (e) {}
    });
  }

  /* ============================================================
     CONSENT, LEGAL, INSTALL, SERVICE WORKER
     ============================================================ */
  const LEGAL_RULES = {
    US: ["COPPA", "CCPA / CPRA", "State-level data breach notification laws"],
    GB: ["UK GDPR", "Data Protection Act 2018", "PECR"],
    DE: ["GDPR", "BDSG", "TTDSG / ePrivacy rules"],
    IN: ["Digital Personal Data Protection Act 2023", "IT Act 2000", "Intermediary and cyber-safety obligations may apply depending on scale and features"],
    BR: ["LGPD"],
    RO: ["GDPR", "Romanian data protection authority guidance", "ePrivacy / cookie consent rules"],
    DEFAULT: ["Check local data protection and privacy laws", "Consider age-verification requirements", "Review e-privacy / cookie regulations", "Assess content liability and intermediary rules"]
  };
  function detectCountry() { const lang = navigator.language || "en-US"; return lang.includes("-") ? lang.split("-")[1].toUpperCase() : "US"; }
  function showLegalRules(code) {
    const list = $("#legal-region-rules"), det = $("#legal-country-detected");
    const c = String(code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    det.textContent = c || "Unknown";
    list.innerHTML = "";
    (LEGAL_RULES[c] || LEGAL_RULES.DEFAULT).forEach((r) => { const li = document.createElement("li"); li.textContent = r; list.appendChild(li); });
  }

  function initConsentAndUtilities() {
    const tosModal = $("#tos-modal");
    if (store.get("qpc_tos_accepted") !== "true") openModal(tosModal);
    $("#btn-accept-tos")?.addEventListener("click", () => {
      store.set("qpc_tos_accepted", "true");
      store.set("qpc_tos_accepted_at", new Date().toISOString());
      el.tos.checked = true;
      closeModal(tosModal);
      el.name?.focus();
    });
    el.tos.addEventListener("change", () => {
      if (el.tos.checked) { store.set("qpc_tos_accepted", "true"); store.set("qpc_tos_accepted_at", new Date().toISOString()); }
      else store.set("qpc_tos_accepted", "false");
    });

    const banner = $("#gdpr-banner");
    if (!store.get("qpc_storage_choice")) banner.classList.remove("hidden");
    const closeBanner = (choice) => { store.set("qpc_storage_choice", choice); store.set("qpc_storage_choice_at", new Date().toISOString()); banner.classList.add("hidden"); };
    $("#gdpr-accept").addEventListener("click", () => closeBanner("accepted_preferences"));
    $("#gdpr-reject").addEventListener("click", () => closeBanner("essential_only"));

    const report = $("#report-modal");
    $("#btn-report").addEventListener("click", () => openModal(report));
    $("#btn-cancel-report").addEventListener("click", () => closeModal(report));
    $("#btn-submit-report").addEventListener("click", () => {
      const t = $("#report-text");
      if (!t.value.trim()) { t.focus(); toast("Describe the problem first.", "fa-solid fa-circle-info"); return; }
      const ctx = session === "room" ? "\n\n(Room: " + roomCode + ")" : "";
      window.location.href = "mailto:nxdecore@gmail.com?subject=" + encodeURIComponent("QUICK PRIVATE CHAT report") + "&body=" + encodeURIComponent(t.value.trim() + ctx);
      t.value = ""; closeModal(report);
      toast("Opening your email app…", "fa-regular fa-envelope");
    });

    $("#btn-download-logs").addEventListener("click", () => {
      const logs = {
        tosAccepted: store.get("qpc_tos_accepted"), tosAcceptedAt: store.get("qpc_tos_accepted_at"),
        storageChoice: store.get("qpc_storage_choice"), storageChoiceAt: store.get("qpc_storage_choice_at"),
        lastRoom: store.get("qpc_last_room"), relayMode: store.get("qpc_mask_ip") === "true",
        appVersion: APP_VERSION, exportedAt: new Date().toISOString()
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "quick-private-chat-consent-log.json";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
    $("#btn-delete-data").addEventListener("click", async () => {
      if (!(await confirmDialog("Delete your data?", "This removes your name, date of birth, friends, call code and consent from this device, then reloads the page.", "Delete data"))) return;
      try { Object.keys(localStorage).filter((k) => k.startsWith("qpc_") || k.includes("berofchat")).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
      window.location.reload();
    });

    const legal = $("#legal-guide-modal"), country = $("#legal-country-input");
    $("#btn-legal-guide").addEventListener("click", () => { const c = detectCountry(); country.value = c; showLegalRules(c); openModal(legal); });
    $("#btn-close-legal-guide").addEventListener("click", () => closeModal(legal));
    country.addEventListener("input", () => { country.value = country.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2); showLegalRules(country.value); });

    // Install
    let deferred = null;
    const installBtn = $("#btn-install"), help = $("#install-help-modal");
    const installed = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const setInstalled = () => { installBtn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>Installed</span>'; };
    if (installed()) setInstalled();
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });
    window.addEventListener("appinstalled", () => { deferred = null; setInstalled(); });
    installBtn.addEventListener("click", async () => {
      if (!installed() && deferred) {
        try { deferred.prompt(); const c = await deferred.userChoice; deferred = null; if (c?.outcome === "accepted") return; } catch (e) {}
      }
      openModal(help);
    });
    $("#btn-close-install-help").addEventListener("click", () => closeModal(help));

    // Close modals when clicking the backdrop (except TOS / incoming / direct)
    $$(".modal").forEach((m) => m.addEventListener("click", (e) => {
      if (e.target !== m) return;
      if (["report-modal", "legal-guide-modal", "install-help-modal"].includes(m.id)) closeModal(m);
    }));

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
    }
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    initEntry();
    initFriends();
    initConsentAndUtilities();
    bindChat();
    initScroll();
    initEmoji();
    initContextMenu();
    initKeyboard();
    resetComposer();
    initPersonalPeer();
    window.__qpc = { get state() { return { session, roomCode, isHost, myPeerId, members: Array.from(members.keys()), connections: Array.from(connections.keys()), inCall, callParticipants: Array.from(callParticipants), activeCalls: Array.from(activeCalls.keys()) }; } };
  }

  init();
})();
