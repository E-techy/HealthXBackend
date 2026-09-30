document.addEventListener('DOMContentLoaded', () => {
    
    // Forms
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const otpForm = document.getElementById('otp-form');
    const forgotForm = document.getElementById('forgot-form');
    const resetForm = document.getElementById('reset-form');
    
    const alertBox = document.getElementById('alert-box');
    const subtitle = document.getElementById('form-subtitle');

    // State Variables
    let pendingEmail = ''; // Used to carry email between steps (Signup->OTP, Forgot->Reset)

    // --- Navigation ---
    document.getElementById('link-to-signup').addEventListener('click', () => {
        switchForm(signupForm, "Create your HealthX Account");
    });
    
    document.getElementById('link-to-login').addEventListener('click', () => {
        switchForm(loginForm, "Sign in to your account");
    });
    
    document.getElementById('link-to-forgot').addEventListener('click', () => {
        switchForm(forgotForm, "Account Recovery");
    });
    
    document.getElementById('link-to-login-from-forgot').addEventListener('click', () => {
        switchForm(loginForm, "Sign in to your account");
    });

    function switchForm(activeForm, newSubtitle) {
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        activeForm.classList.add('active');
        subtitle.textContent = newSubtitle;
        hideAlert();
    }

    function showAlert(message, isError = true) {
        alertBox.textContent = message;
        alertBox.className = `alert ${isError ? 'error' : 'success'}`;
    }

    function hideAlert() {
        alertBox.className = 'alert hidden';
    }

    function setAuthCookie(token) {
        const d = new Date();
        d.setTime(d.getTime() + (7*24*60*60*1000));
        document.cookie = `healthx_auth=${token}; expires=${d.toUTCString()}; path=/`;
    }

    // --- 1. LOGIN ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-login');
        btn.disabled = true;
        hideAlert();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success) {
                setAuthCookie(data.token);
                window.location.href = '/emergency/index.html';
            } else {
                if (data.message.includes('verify')) {
                    pendingEmail = email;
                    switchForm(otpForm, "Verify your email");
                    showAlert("Please verify your email. OTP was sent during signup.", true);
                } else {
                    showAlert(data.message);
                }
            }
        } catch (err) {
            showAlert("Network error connecting to server.");
        } finally {
            btn.disabled = false;
        }
    });

    // --- 2. SIGNUP ---
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-signup');
        btn.disabled = true;
        hideAlert();

        const formData = new FormData();
        formData.append('name', document.getElementById('signup-name').value);
        
        pendingEmail = document.getElementById('signup-email').value;
        formData.append('email', pendingEmail);
        formData.append('password', document.getElementById('signup-password').value);
        
        const fileInput = document.getElementById('signup-image');
        if (fileInput.files.length > 0) {
            formData.append('profileImage', fileInput.files[0]);
        }

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                body: formData 
            });
            const data = await res.json();

            if (data.success) {
                showAlert(data.message, false);
                switchForm(otpForm, "Verify your email");
            } else {
                showAlert(data.message);
            }
        } catch (err) {
            showAlert("Network error connecting to server.");
        } finally {
            btn.disabled = false;
        }
    });

    // --- 3. VERIFY OTP (For Signup) ---
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-verify');
        btn.disabled = true;
        hideAlert();

        const otp = document.getElementById('otp-code').value;

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingEmail, otp })
            });
            const data = await res.json();

            if (data.success) {
                setAuthCookie(data.token);
                window.location.href = '/emergency/index.html';
            } else {
                showAlert(data.message);
            }
        } catch (err) {
            showAlert("Network error connecting to server.");
        } finally {
            btn.disabled = false;
        }
    });

    // --- 4. FORGOT PASSWORD (Send OTP) ---
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-forgot');
        btn.disabled = true;
        hideAlert();

        pendingEmail = document.getElementById('forgot-email').value;

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingEmail })
            });
            const data = await res.json();

            if (data.success) {
                showAlert(data.message, false);
                switchForm(resetForm, "Reset Password");
            } else {
                showAlert(data.message);
            }
        } catch (err) {
            showAlert("Network error connecting to server.");
        } finally {
            btn.disabled = false;
        }
    });

    // --- 5. RESET PASSWORD ---
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-reset');
        btn.disabled = true;
        hideAlert();

        const otp = document.getElementById('reset-otp').value;
        const newPassword = document.getElementById('reset-new-password').value;

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingEmail, otp, newPassword })
            });
            const data = await res.json();

            if (data.success) {
                showAlert("Password updated successfully. You can now sign in.", false);
                switchForm(loginForm, "Sign in to your account");
                document.getElementById('login-email').value = pendingEmail; // Pre-fill email
            } else {
                showAlert(data.message);
            }
        } catch (err) {
            showAlert("Network error connecting to server.");
        } finally {
            btn.disabled = false;
        }
    });
});