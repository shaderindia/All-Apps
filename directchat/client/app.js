const socket = io("http://localhost:3000");

let username, room, cryptoKey;

// 🔐 KEY GENERATION
async function generateKey(password) {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );

  cryptoKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// 🔒 ENCRYPT
async function encryptMessage(text) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    enc.encode(text)
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
}

// 🔓 DECRYPT
async function decryptMessage(payload) {
  const dec = new TextDecoder();

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    cryptoKey,
    new Uint8Array(payload.data)
  );

  return dec.decode(decrypted);
}

// 👤 AVATAR
function getAvatar(username) {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;
}

// 🚪 JOIN
async function joinChat() {
  username = document.getElementById("username").value;
  room = document.getElementById("room").value;
  const password = document.getElementById("password").value;

  await generateKey(password);

  socket.emit("join", { username, room });

  document.getElementById("login").classList.add("hidden");
  document.getElementById("chat").classList.remove("hidden");
}

// 💬 SEND
async function sendMessage() {
  const msg = document.getElementById("msgInput").value;
  const payload = await encryptMessage(msg);

  socket.emit("sendMessage", payload);
}

// 🔐 PRIVATE
async function sendPrivate() {
  const to = document.getElementById("privateUser").value;
  const msg = document.getElementById("msgInput").value;

  const payload = await encryptMessage(msg);

  socket.emit("privateMessage", { toUsername: to, payload });
}

// 📎 FILE
function sendFile() {
  const file = document.getElementById("fileInput").files[0];
  const reader = new FileReader();

  reader.onload = () => {
    socket.emit("file", {
      name: file.name,
      data: reader.result
    });
  };

  reader.readAsDataURL(file);
}

// ✍️ TYPING
let timeout;
document.getElementById("msgInput").addEventListener("input", () => {
  socket.emit("typing");

  clearTimeout(timeout);
  timeout = setTimeout(() => socket.emit("stopTyping"), 1000);
});

// 🧾 DISPLAY
function addMessage(user, text) {
  const div = document.createElement("div");

  const img = document.createElement("img");
  img.src = getAvatar(user);
  img.width = 30;

  div.appendChild(img);
  div.append(`${user}: ${text}`);

  document.getElementById("messages").appendChild(div);
}

// 📥 RECEIVE
socket.on("message", async (msg) => {
  const text = await decryptMessage(msg.message);
  addMessage(msg.username, text);
});

socket.on("privateMessage", async (msg) => {
  const text = await decryptMessage(msg.message);
  addMessage(`[PRIVATE] ${msg.username}`, text);
});

socket.on("file", (msg) => {
  const a = document.createElement("a");
  a.href = msg.file.data;
  a.download = msg.file.name;
  a.innerText = `${msg.username} sent ${msg.file.name}`;
  document.getElementById("messages").appendChild(a);
});

socket.on("typing", (user) => {
  document.getElementById("typing").innerText = `${user} typing...`;
});

socket.on("stopTyping", () => {
  document.getElementById("typing").innerText = "";
});

socket.on("userList", (users) => {
  const ul = document.getElementById("users");
  ul.innerHTML = "";

  users.forEach(u => {
    const li = document.createElement("li");
    li.innerText = u;
    ul.appendChild(li);
  });
});

function toggleDark() {
  document.body.classList.toggle("dark");
}
