exports.renderPasswordPage = (publicKey, errorMessage = null) => {
    // If there's an error, inject a red error box
    const errorHtml = errorMessage 
        ? `<div class="error-box">${errorMessage}</div>` 
        : '';

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HealthX - Secure Document</title>
        <style>
            body { 
                font-family: system-ui, -apple-system, sans-serif; 
                background-color: #000; 
                color: #fff; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0; 
            }
            .card { 
                background-color: #1E1E1E; 
                padding: 2.5rem; 
                border-radius: 16px; 
                text-align: center; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
                width: 90%; 
                max-width: 350px; 
            }
            h2 { margin-top: 0; color: #64B5F6; }
            p { color: #aaa; font-size: 14px; margin-bottom: 1.5rem; }
            .error-box {
                color: #E53935;
                font-size: 14px;
                font-weight: bold;
                background: rgba(229, 57, 53, 0.1);
                padding: 10px;
                border-radius: 8px;
                margin-bottom: 1rem;
                border: 1px solid rgba(229, 57, 53, 0.3);
            }
            input { 
                width: 100%; 
                padding: 12px; 
                margin-bottom: 1rem; 
                box-sizing: border-box; 
                border-radius: 8px; 
                border: 1px solid #333; 
                background-color: #121212; 
                color: #fff; 
                font-size: 16px; 
            }
            input:focus { outline: none; border-color: #1E88E5; }
            .button-group {
                display: flex;
                gap: 10px;
                margin-top: 0.5rem;
            }
            button { 
                flex: 1;
                padding: 14px; 
                border: none; 
                border-radius: 8px; 
                font-weight: bold; 
                font-size: 14px; 
                cursor: pointer; 
                transition: 0.2s; 
            }
            .btn-view { 
                background-color: #1E88E5; 
                color: #fff; 
            }
            .btn-view:hover { background-color: #1565C0; }
            .btn-download { 
                background-color: transparent; 
                color: #fff; 
                border: 1px solid #1E88E5; 
            }
            .btn-download:hover { background-color: rgba(30, 136, 229, 0.1); }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>🔒 Secure Document</h2>
            <p>This document is password protected. Enter the password below to access it.</p>
            ${errorHtml}
            <form action="/api/docs/public/${publicKey}/secure" method="POST">
                <input type="password" name="password" placeholder="Enter Password" required autofocus />
                <div class="button-group">
                    <button type="submit" name="action" value="view" class="btn-view">View Inline</button>
                    <button type="submit" name="action" value="download" class="btn-download">Download</button>
                </div>
            </form>
        </div>
    </body>
    </html>
    `;
};