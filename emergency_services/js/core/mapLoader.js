/**
 * MapLoader
 * 
 * Responsible for injecting the Google Maps bootstrap script into the DOM.
 * Depends on ApiConfigService to provide the secure API key.
 */
class MapLoader {
    constructor() {
        this.isLoaded = false;
        this.loadingPromise = null;
    }

    // Main initialization function called by other map scripts
    async loadGoogleMaps(forceRefresh = false) {
        // If already loaded, resolve instantly
        if (this.isLoaded && !forceRefresh) return Promise.resolve();
        
        // Prevent multiple simultaneous load requests triggering script injection twice
        if (this.loadingPromise && !forceRefresh) return this.loadingPromise;

        this.loadingPromise = (async () => {
            try {
                // 1. Fetch the API key using our new centralized service
                const apiKey = await window.apiConfigService.getMapsApiKey(forceRefresh);
                
                return new Promise((resolve, reject) => {
                    // 2. If Google Maps is already attached to the window, skip injection
                    if (window.google && window.google.maps && !forceRefresh) {
                        this.isLoaded = true;
                        return resolve();
                    }

                    // 3. Dynamically execute the Google Maps bootstrapper
                    try {
                        // Using Google's official inline bootstrapper
                        (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})
                        ({
                            key: apiKey, 
                            v: "weekly" // UPDATE: "weekly" is recommended for Places API (New) & Advanced Markers
                        });
                        
                        this.isLoaded = true;
                        console.log("✅ [MapLoader] Google Maps API Bootstrapper injected successfully.");
                        resolve();
                        
                    } catch (err) {
                        console.error("❌ [MapLoader] Failed to inject Maps script:", err);
                        reject(err);
                    }
                });
            } catch (error) {
                console.error("❌ [MapLoader] Initialization Error:", error);
                throw error;
            }
        })();

        return this.loadingPromise;
    }
}

// Make globally available so sphereMap, flatMap, and tileManager can use it
window.mapLoader = new MapLoader();
