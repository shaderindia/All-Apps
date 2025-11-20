// ================================
// Supabase Auth Protection Script
// ================================

// --- CONFIG ---
const SUPABASE_URL = "https://wtryahnysabnjdcypihl.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cnlhaG55c2FibmpkY3lwaWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTM0NTAsImV4cCI6MjA3NzY4OTQ1MH0.uLi6Nfk8NQ9KmR_Igt9sb_wtQxtujm_lipT6TU3dwjM";

// Create Supabase client
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hide page first — prevents unauthorized users from seeing content for even 1ms
document.addEventListener("DOMContentLoaded", () => {
  document.body.style.display = "none";
});

// Protect page
async function protectPage() {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    // Not logged in → redirect
    window.location.href = "login.html";
  } else {
    // Logged in → show page
    document.body.style.display = "block";
  }
}

protectPage();

// Logout function — call using onclick="logout()"
async function logout() {
  await client.auth.signOut();
  window.location.href = "login.html";
}

// Auto-redirect when logged out from another tab
client.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    window.location.href = "login.html";
  }
});
