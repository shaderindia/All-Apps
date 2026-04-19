// ============================================================
// BER OF CHAT — Login & Signup Logic
// MTALKZ API Key: NuDhjmSw8RUV0Hf5YlybqbHrCY7AI5
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

    // --- Helper Functions ---
    function showStatus(msg, isError = false) {
        statusMsg.textContent = msg;
        statusMsg.className = `status-msg ${isError ? 'status-error' : 'status-success'}`;
    }

    function clearStatus() {
        statusMsg.textContent = '';
        statusMsg.className = 'status-msg';
    }

    // Normalize phone: strip spaces/hyphens, auto-add +91 for Indian numbers
    function normalizePhone(raw) {
        let phone = raw.replace(/[\s\-\(\)]/g, '');
        // If user typed a 10-digit number without country code, assume India (+91)
        if (/^\d{10}$/.test(phone)) {
            phone = '+91' + phone;
        }
        // If user typed 91XXXXXXXXXX (12 digits), add +
        if (/^91\d{10}$/.test(phone)) {
            phone = '+' + phone;
        }
        // Ensure it starts with +
        if (!phone.startsWith('+')) {
            phone = '+' + phone;
        }
        return phone;
    }

    // Tab Switching
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        clearStatus();
    });

    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        clearStatus();
    });

    // =========================================================
    // LOGIN FLOW
    // =========================================================
    const btnLogin = document.getElementById('btn-login');
    btnLogin.addEventListener('click', async () => {
        let phone = normalizePhone(document.getElementById('login-phone').value.trim());
        const password = document.getElementById('login-password').value;

        if (!phone || phone.length < 12 || !password) {
            showStatus('Please enter a valid phone number and password', true);
            return;
        }

        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';

        try {
            const { data, error } = await supabase.rpc('login_user', {
                p_phone: phone,
                p_password: password
            });

            if (error || !data || !data.success) {
                showStatus(data?.error || error?.message || 'Login failed', true);
            } else {
                showStatus('Login successful! Redirecting...', false);
                localStorage.setItem('ber_user', JSON.stringify(data.user));
                setTimeout(() => { window.location.href = 'index.html'; }, 1200);
            }
        } catch (err) {
            showStatus('An error occurred during login', true);
            console.error('[Login Error]', err);
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<span>Log In</span> <i class="fa-solid fa-right-to-bracket"></i>';
        }
    });

    // =========================================================
    // SIGNUP STEP 1: Send OTP
    // =========================================================
    const btnSendOtp = document.getElementById('btn-send-otp');
    btnSendOtp.addEventListener('click', async () => {
        const name = document.getElementById('signup-name').value.trim();
        let phone = normalizePhone(document.getElementById('signup-phone').value.trim());
        const gdprChecked = document.getElementById('signup-gdpr').checked;

        if (!name) {
            showStatus('Display name is required', true);
            return;
        }
        if (!phone || phone.length < 12) {
            showStatus('Enter a valid phone number (e.g. 9876543210)', true);
            return;
        }
        if (!gdprChecked) {
            showStatus('You must consent to data processing to sign up.', true);
            return;
        }

        btnSendOtp.disabled = true;
        btnSendOtp.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';
        showStatus('Generating OTP...', false);

        try {
            // Step 1: Generate OTP via Supabase RPC
            const { data: otpResult, error: otpError } = await supabase.rpc('request_otp', {
                p_phone: phone,
                p_purpose: 'signup'
            });

            if (otpError) {
                showStatus('Server error: ' + otpError.message, true);
                return;
            }
            if (!otpResult || !otpResult.success) {
                showStatus(otpResult?.error || 'Failed to generate OTP', true);
                return;
            }

            const otp = otpResult.otp;

            // Step 2: Send OTP via MTALKZ SMS API
            showStatus('Sending SMS...', false);
            const smsNumber = phone.replace('+', '');
            const smsResponse = await fetch('https://msg.mtalkz.com/V2/http-api-post.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apikey: 'NuDhjmSw8RUV0Hf5YlybqbHrCY7AI5',
                    senderid: 'SHDR7I',
                    number: smsNumber,
                    message: `Your BER OF CHAT verification code is: ${otp}. Valid for 5 minutes. Do not share this code. - SHADER7`,
                    format: 'json'
                })
            });

            const smsText = await smsResponse.text();
            console.log('[MTALKZ Response]', smsText);

            // Move to step 2 regardless of SMS response (OTP is stored in DB)
            currentPhone = phone;
            signupStep1.classList.add('hidden');
            signupStep2.classList.remove('hidden');
            signupStep2.classList.add('fade-in');
            showStatus('OTP sent to ' + phone, false);

        } catch (err) {
            showStatus('Error sending OTP. Check your connection.', true);
            console.error('[OTP Error]', err);
        } finally {
            btnSendOtp.disabled = false;
            btnSendOtp.innerHTML = '<span>Send OTP</span> <i class="fa-solid fa-paper-plane"></i>';
        }
    });

    // =========================================================
    // SIGNUP STEP 2: Verify OTP
    // =========================================================
    const btnVerifyOtp = document.getElementById('btn-verify-otp');
    btnVerifyOtp.addEventListener('click', async () => {
        const otp = document.getElementById('signup-otp').value.trim();

        if (otp.length !== 6) {
            showStatus('Enter the 6-digit OTP', true);
            return;
        }

        btnVerifyOtp.disabled = true;
        btnVerifyOtp.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';

        try {
            const { data, error } = await supabase.rpc('verify_otp', {
                p_phone: currentPhone,
                p_otp: otp
            });

            if (error || !data || !data.success) {
                showStatus(data?.error || error?.message || 'Invalid or expired OTP', true);
            } else {
                signupStep2.classList.add('hidden');
                signupStep3.classList.remove('hidden');
                signupStep3.classList.add('fade-in');
                showStatus('Phone verified! Create your password.', false);
            }
        } catch (err) {
            showStatus('Verification error', true);
            console.error('[Verify Error]', err);
        } finally {
            btnVerifyOtp.disabled = false;
            btnVerifyOtp.innerHTML = '<span>Verify OTP</span> <i class="fa-solid fa-check-double"></i>';
        }
    });

    // =========================================================
    // SIGNUP STEP 3: Create Account
    // =========================================================
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
        btnCreateAccount.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating...';

        try {
            const { data, error } = await supabase.rpc('signup_user', {
                p_phone: currentPhone,
                p_password: password,
                p_name: name
            });

            if (error || !data || !data.success) {
                showStatus(data?.error || error?.message || 'Signup failed', true);
            } else {
                showStatus('Account created! Logging in...', false);

                // Auto-login
                const loginRes = await supabase.rpc('login_user', {
                    p_phone: currentPhone,
                    p_password: password
                });

                if (loginRes.data?.success) {
                    localStorage.setItem('ber_user', JSON.stringify(loginRes.data.user));
                    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
                } else {
                    showStatus('Account created. Please log in manually.', false);
                    tabLogin.click();
                }
            }
        } catch (err) {
            showStatus('Signup error', true);
            console.error('[Signup Error]', err);
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
