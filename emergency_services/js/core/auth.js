document.addEventListener('DOMContentLoaded', () => {
    
    // Function to read cookies
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // 1. Check if user is logged in
    const token = getCookie('healthx_auth');

    if (!token) {
        // No token found, redirect to the separate login page
        window.location.href = '/emergency/auth.html';
        return;
    }

    // 2. Token exists! Show the UI layer and update status
    document.getElementById('ui-layer').style.display = 'block';
    
    const statusEl = document.getElementById('auth-status');
    statusEl.textContent = 'Authenticated (Live)';
    statusEl.className = 'status-indicator connected';

    // 3. (Optional but recommended) Emit a global event so tracking/routing APIs 
    // know they have a token available to attach to their `Authorization: Bearer` headers.
    if (window.EventBus) {
        window.EventBus.emit('auth_ready', { token });
    }

    // 4. Logout Logic
    document.getElementById('btn-logout').addEventListener('click', () => {
        // Delete the cookie by setting expiry to a past date
        document.cookie = 'healthx_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.href = '/emergency/auth.html';
    });
});