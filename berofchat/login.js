// ============================================================
// BER OF CHAT — Login & Signup Logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase
    if (typeof initSupabase === 'function') {
        initSupabase();
    }

    // UI Elements
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const statusMsg = document.getElementById('status-msg');

    const signupStep1 = document.getElementById('signup-step-1');
    const signupStep2 = document.getElementById('signup-step-2');
    const signupStep3 = document.getElementById('signup-step-3');

    // State
    let currentPhone = '';
    let currentPurpose = 'signup'; // 'signup' or 'login'

    // Tab Switching
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        currentPurpose = 'login';
        clearStatus();
    });

    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        currentPurpose = 'signup';
        clearStatus();
    });

    // --- Helper Functions ---
    function showStatus(msg, isError = false) {
        statusMsg.textContent = msg;
        statusMsg.className = `status-msg ${isError ? 'status-error' : 'status-success'}`;
    }

    function clearStatus() {
        statusMsg.textContent = '';
        statusMsg.className = 'status-msg';
    }

    // --- Login Flow ---
    const btnLogin = document.getElementById('btn-login');
    btnLogin.addEventListener('click', async () => {
        let phone = document.getElementById('login-phone').value.trim();
        phone = phone.replace(/[\s\-]/g, ''); // Remove spaces and hyphens
        const password = document.getElementById('login-password').value;

        if (!phone || !password) {
            showStatus('Please enter phone and password', true);
            return;
        }

        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';

        try {
            const { data, error } = await supabase.rpc('login_user', {
                p_phone: phone,
                p_password: password
            });

            if (error || !data.success) {
                showStatus(data?.error || error?.message || 'Login failed', true);
            } else {
                showStatus('Login successful! Redirecting...', false);
                // Store user in local storage
                localStorage.setItem('ber_user', JSON.stringify(data.user));
                // Redirect to main app
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }
        } catch (err) {
            showStatus('An error occurred during login', true);
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<span>Log In</span> <i class="fa-solid fa-right-to-bracket"></i>';
        }
    });

    // --- Signup Flow Step 1: Send OTP ---
    const btnSendOtp = document.getElementById('btn-send-otp');
    btnSendOtp.addEventListener('click', async () => {
        const name = document.getElementById('signup-name').value.trim();
        let phone = document.getElementById('signup-phone').value.trim();
        phone = phone.replace(/[\s\-]/g, ''); // Remove spaces and hyphens
        const gdprChecked = document.getElementById('signup-gdpr').checked;

        if (!name || !phone) {
            showStatus('Name and phone are required', true);
            return;
        }

        if (phone.length < 10) {
            showStatus('Enter a valid phone number', true);
            return;
        }

        if (!gdprChecked) {
            showStatus('You must consent to data processing to sign up.', true);
            return;
        }

        btnSendOtp.disabled = true;
        btnSendOtp.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';

        try {
            // Call Supabase Edge Function to send OTP via MTALKZ
            const response = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ phone, purpose: 'signup' })
            });

            const result = await response.json();

            if (result.success) {
                currentPhone = phone;
                signupStep1.classList.add('hidden');
                signupStep2.classList.remove('hidden');
                signupStep2.classList.add('fade-in');
                showStatus('OTP sent successfully', false);
            } else {
                showStatus(result.error || 'Failed to send OTP', true);
            }
        } catch (err) {
            showStatus('Error calling OTP service', true);
            console.error(err);
        } finally {
            btnSendOtp.disabled = false;
            btnSendOtp.innerHTML = '<span>Send OTP</span> <i class="fa-solid fa-paper-plane"></i>';
        }
    });

    // --- Signup Flow Step 2: Verify OTP ---
    const btnVerifyOtp = document.getElementById('btn-verify-otp');
    btnVerifyOtp.addEventListener('click', async () => {
        const otp = document.getElementById('signup-otp').value.trim();

        if (otp.length !== 6) {
            showStatus('Enter 6-digit OTP', true);
            return;
        }

        btnVerifyOtp.disabled = true;
        btnVerifyOtp.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';

        try {
            const { data, error } = await supabase.rpc('verify_otp', {
                p_phone: currentPhone,
                p_otp: otp
            });

            if (error || !data.success) {
                showStatus(data?.error || error?.message || 'Invalid OTP', true);
            } else {
                signupStep2.classList.add('hidden');
                signupStep3.classList.remove('hidden');
                signupStep3.classList.add('fade-in');
                showStatus('Phone verified!', false);
            }
        } catch (err) {
            showStatus('Verification error', true);
        } finally {
            btnVerifyOtp.disabled = false;
            btnVerifyOtp.innerHTML = '<span>Verify OTP</span> <i class="fa-solid fa-check-double"></i>';
        }
    });

    // --- Signup Flow Step 3: Complete Signup ---
    const btnCreateAccount = document.getElementById('btn-create-account');
    btnCreateAccount.addEventListener('click', async () => {
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-password-confirm').value;
        const name = document.getElementById('signup-name').value.trim();

        if (!password || password.length < 6) {
            showStatus('Password must be at least 6 characters', true);
            return;
        }

        if (password !== confirm) {
            showStatus('Passwords do not match', true);
            return;
        }

        btnCreateAccount.disabled = true;
        btnCreateAccount.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Completing...';

        try {
            const { data, error } = await supabase.rpc('signup_user', {
                p_phone: currentPhone,
                p_password: password,
                p_name: name
            });

            if (error || !data.success) {
                showStatus(data?.error || error?.message || 'Signup failed', true);
            } else {
                showStatus('Account created! Logging in...', false);
                
                // Auto login after signup
                const loginRes = await supabase.rpc('login_user', {
                    p_phone: currentPhone,
                    p_password: password
                });

                if (loginRes.data?.success) {
                    localStorage.setItem('ber_user', JSON.stringify(loginRes.data.user));
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                } else {
                    showStatus('Account created, please log in.', false);
                    tabLogin.click();
                }
            }
        } catch (err) {
            showStatus('Signup error', true);
        } finally {
            btnCreateAccount.disabled = false;
            btnCreateAccount.innerHTML = '<span>Complete Signup</span> <i class="fa-solid fa-circle-check"></i>';
        }
    });

    // Resend OTP
    const btnResendOtp = document.getElementById('btn-resend-otp');
    btnResendOtp.addEventListener('click', () => {
        signupStep2.classList.add('hidden');
        signupStep1.classList.remove('hidden');
        signupStep1.classList.add('fade-in');
        clearStatus();
    });
});
