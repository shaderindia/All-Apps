// ================================
// Supabase Auth Protection Script
// ================================

// Config
const SUPABASE_URL = "https://wtryahnysabnjdcypihl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_t6JRyAB4wMHkMmnF8ow6Ww_-fEs6C-N";

// Create client
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hide content until auth is verified
document.addEventListener("DOMContentLoaded", () => {
  document.body.style.display = "none";
});

// Protect page
async function protectPage() {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    window.location.href = "login.html";
  } else {
    document.body.style.display = "block";
  }
}

protectPage();

// Logout function for buttons
async function logout() {
  await client.auth.signOut();
  window.location.href = "login.html";
}

// Auto redirect when logged out in another tab
client.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    window.location.href = "login.html";
  }
});
