// ================================
// Supabase Auth Protection Script
// ================================

// Config - Use YOUR Supabase credentials
const SUPABASE_URL = "https://wtryahnysabnjdcypihl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cnlhaG55c2FibmpkY3lwaWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTM0NTAsImV4cCI6MjA3NzY4OTQ1MH0.uLi6Nfk8NQ9KmR_Igt9sb_wtQxtujm_lipT6TU3dwjM";

// Create client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hide content until auth is verified
document.addEventListener("DOMContentLoaded", () => {
  document.body.style.display = "none";
  protectPage();
});

// Protect page function
async function protectPage() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    window.location.href = "login.html";
  } else {
    document.body.style.display = "block";
    // Dispatch custom event for main script
    document.dispatchEvent(new CustomEvent('auth-verified', { detail: data.user }));
  }
}

// Logout function for buttons
async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error('Logout error:', error);
    alert('Logout failed. Please try again.');
  } else {
    window.location.href = "login.html";
  }
}

// Auto redirect when logged out in another tab
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    window.location.href = "login.html";
  } else if (event === "TOKEN_REFRESHED") {
    // Token refreshed, continue as normal
    console.log('Token refreshed');
  }
});
