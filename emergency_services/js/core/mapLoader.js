class MapLoader {
    constructor() {
        this.isLoaded = false;
        this.loadingPromise = null;
    }

    // Helper to get the JWT token from cookies
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Securely fetch the key from the backend
    async fetchApiKey(forceRefresh = false) {
        let key = sessionStorage.getItem('mapsApiKey');
        
        // Return cached key if it exists and we aren't forcing a refresh
        if (key && !forceRefresh) {
            return key;
        }

        const token = this.getCookie('healthx_auth');
        if (!token) throw new Error("Authentication required to fetch Maps API key.");

        console.log("Fetching new Maps API Key from server...");
        
        const response = await fetch('/api/config/maps-key', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success && data.data.mapsApiKey) {
            sessionStorage.setItem('mapsApiKey', data.data.mapsApiKey);
            return data.data.mapsApiKey;
        } else {
            throw new Error(data.message || "Failed to fetch Maps API key from backend.");
        }
    }

    // Main initialization function called by other map scripts
    async loadGoogleMaps(forceRefresh = false) {
        if (this.isLoaded && !forceRefresh) return Promise.resolve();
        
        // Prevent multiple simultaneous load requests
        if (this.loadingPromise && !forceRefresh) return this.loadingPromise;

        this.loadingPromise = (async () => {
            try {
                const apiKey = await this.fetchApiKey(forceRefresh);
                
                return new Promise((resolve, reject) => {
                    // If Google Maps is already loaded on the window, skip injection
                    if (window.google && window.google.maps && !forceRefresh) {
                        this.isLoaded = true;
                        return resolve();
                    }

                    // Dynamically execute the Google Maps bootstrapper with our secure key
                    try {
                        (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})
                        ({key: apiKey, v: "alpha"});
                        
                        this.isLoaded = true;
                        console.log("✅ Google Maps API Bootstrapper injected successfully.");
                        resolve();
                    } catch (err) {
                        console.error("Failed to inject Maps script", err);
                        reject(err);
                    }
                });
            } catch (error) {
                console.error("MapLoader Error:", error);
                throw error;
            }
        })();

        return this.loadingPromise;
    }
}

// Make it globally available so sphereMap, flatMap, and tileManager can use it
window.mapLoader = new MapLoader();