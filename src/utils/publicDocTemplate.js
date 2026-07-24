exports.renderPasswordPage = (publicKey, errorMessage = null) => {
    // If there's an error, inject a styled red error box with an alert icon
    const errorHtml = errorMessage 
        ? `<div class="error-box">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
             ${errorMessage}
           </div>` 
        : '';

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HealthX | Secure Document Access</title>
        <style>
            :root {
                --primary: #1E88E5;
                --primary-hover: #1565C0;
                --bg-dark: #0A0A0A;
                --card-bg: #141414;
                --border: #2C2C2C;
                --text-main: #FFFFFF;
                --text-muted: #A0A0A0;
                --error-bg: rgba(229, 57, 53, 0.1);
                --error-border: rgba(229, 57, 53, 0.3);
                --error-text: #EF5350;
            }
            body { 
                font-family: 'Inter', system-ui, -apple-system, sans-serif; 
                background-color: var(--bg-dark); 
                color: var(--text-main); 
                display: flex; 
                flex-direction: column;
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                margin: 0; 
                padding: 20px;
                box-sizing: border-box;
            }
            .brand {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 2rem;
                font-size: 24px;
                font-weight: 800;
                letter-spacing: -0.5px;
            }
            .brand-icon {
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, var(--primary), #64B5F6);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 20px;
            }
            .card { 
                background-color: var(--card-bg); 
                padding: 2.5rem 2rem; 
                border-radius: 20px; 
                text-align: center; 
                box-shadow: 0 20px 40px rgba(0,0,0,0.6); 
                width: 100%; 
                max-width: 400px; 
                border: 1px solid var(--border);
                box-sizing: border-box;
            }
            .icon-lock {
                width: 56px;
                height: 56px;
                background: rgba(30, 136, 229, 0.1);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1.5rem;
                color: var(--primary);
            }
            h2 { 
                margin: 0 0 0.5rem 0; 
                font-size: 22px;
                font-weight: 600;
            }
            p { 
                color: var(--text-muted); 
                font-size: 14px; 
                line-height: 1.5;
                margin-bottom: 2rem; 
            }
            .error-box {
                color: var(--error-text);
                font-size: 14px;
                background: var(--error-bg);
                padding: 12px;
                border-radius: 10px;
                margin-bottom: 1.5rem;
                border: 1px solid var(--error-border);
                display: flex;
                align-items: center;
                gap: 8px;
                text-align: left;
            }
            .input-group {
                position: relative;
                margin-bottom: 1.5rem;
            }
            input { 
                width: 100%; 
                padding: 14px 45px 14px 16px; 
                box-sizing: border-box; 
                border-radius: 12px; 
                border: 1px solid var(--border); 
                background-color: #000; 
                color: var(--text-main); 
                font-size: 16px; 
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            input:focus { 
                outline: none; 
                border-color: var(--primary); 
                box-shadow: 0 0 0 3px rgba(30, 136, 229, 0.2);
            }
            .toggle-pwd {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .toggle-pwd:hover { color: var(--text-main); }
            
            /* Buttons layout changes based on screen size */
            .button-group {
                display: flex;
                gap: 12px;
                flex-direction: column; 
            }
            button.action-btn { 
                width: 100%;
                padding: 14px; 
                border-radius: 12px; 
                font-weight: 600; 
                font-size: 15px; 
                cursor: pointer; 
                transition: all 0.2s ease; 
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .btn-view { 
                background-color: var(--primary); 
                color: #fff; 
                border: none;
            }
            .btn-view:hover { 
                background-color: var(--primary-hover); 
                transform: translateY(-1px);
            }
            .btn-download { 
                background-color: transparent; 
                color: var(--text-main); 
                border: 1px solid var(--border); 
            }
            .btn-download:hover { 
                background-color: rgba(255,255,255,0.05); 
                border-color: #444;
            }
            .footer {
                margin-top: 2.5rem;
                text-align: center;
                color: #666;
                font-size: 13px;
                max-width: 320px;
                line-height: 1.6;
            }
            .footer strong { color: #888; }

            /* Desktop layout overrides */
            @media (min-width: 480px) {
                .button-group {
                    flex-direction: row;
                }
            }
        </style>
    </head>
    <body>
        <div class="brand">
            <div class="brand-icon">✦</div>
            HealthX
        </div>

        <div class="card">
            <div class="icon-lock">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2>Protected Document</h2>
            <p>This medical document was shared via HealthX. Enter the password below to unlock it.</p>
            
            ${errorHtml}
            
            <form action="/api/docs/public/${publicKey}/secure" method="POST">
                <div class="input-group">
                    <input type="password" id="password" name="password" placeholder="Enter Document Password" required autofocus />
                    <button type="button" class="toggle-pwd" id="toggleBtn" title="Toggle Password Visibility">
                        <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </div>
                
                <div class="button-group">
                    <button type="submit" name="action" value="view" class="action-btn btn-view">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        View File
                    </button>
                    <button type="submit" name="action" value="download" class="action-btn btn-download">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download
                    </button>
                </div>
            </form>
        </div>

        <div class="footer">
            Shared securely via <strong>HealthX Vault</strong>.<br> 
            Your end-to-end encrypted medical data platform.
        </div>

        <script>
            // JavaScript for toggling the password visibility
            const pwdInput = document.getElementById('password');
            const toggleBtn = document.getElementById('toggleBtn');
            const eyeIcon = document.getElementById('eye-icon');

            toggleBtn.addEventListener('click', () => {
                if (pwdInput.type === 'password') {
                    pwdInput.type = 'text';
                    // Render "Eye Off" icon
                    eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
                } else {
                    pwdInput.type = 'password';
                    // Render "Eye On" icon
                    eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
                }
            });
        </script>
    </body>
    </html>
    `;
};