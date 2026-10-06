/**
 * HealthX - Emergency API Service
 * Handles backend communication and public location data fetching.
 */
class EmergencyAPI {
    constructor() {
        this.baseUrl = window.API_BASE_URL || '';
        this.locData = { countries: [], states: [], cities: [] };
        this.searchLocData = { states: [], cities: [] }; // Pre-fetched data for Search filters
    }

    // --- Auth Helper ---
    getToken() {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; healthx_auth=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    getHeaders() {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    // --- Backend Endpoints ---
    async createEmergency(payload) {
        console.log(`📤 [EmergencyAPI] POST /api/emergency/create\nPayload:`, JSON.stringify(payload, null, 2));
        const res = await fetch(`${this.baseUrl}/api/emergency/create`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`📥 [EmergencyAPI] Create Response:`, data);
        return data;
    }

    async searchEmergencies(filters) {
        const params = new URLSearchParams(filters);
        console.log(`📤 [EmergencyAPI] GET /api/emergency/search?${params.toString()}`);
        const res = await fetch(`${this.baseUrl}/api/emergency/search?${params.toString()}`);
        const data = await res.json();
        console.log(`📥 [EmergencyAPI] Search Response:`, data);
        return data;
    }

    async joinEmergency(trackingId, password) {
        console.log(`📤 [EmergencyAPI] POST /api/emergency/join/credentials for ${trackingId}`);
        const res = await fetch(`${this.baseUrl}/api/emergency/join/credentials`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ emergencyTrackingId: trackingId, password })
        });
        const data = await res.json();
        console.log(`📥 [EmergencyAPI] Join Response:`, data);
        return data;
    }

    // --- Public Location API (countriesnow.space) ---
    async fetchGlobalCountries() {
        try {
            console.log("🌍 [LocationAPI] Fetching global countries...");
            const res = await fetch("https://countriesnow.space/api/v0.1/countries/positions");
            const data = await res.json();
            if (!data.error) this.locData.countries = data.data.map(c => c.name);
        } catch (err) { console.error("LocationAPI Error:", err); }
    }

    async fetchStatesForCountry(countryName) {
        try {
            console.log(`🌍 [LocationAPI] Fetching states for ${countryName}...`);
            const res = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: countryName })
            });
            const data = await res.json();
            this.locData.states = !data.error ? data.data.states.map(s => s.name) : [];
            return this.locData.states;
        } catch (err) { return []; }
    }

    async fetchCitiesForState(countryName, stateName) {
        try {
            console.log(`🌍 [LocationAPI] Fetching cities for ${stateName}, ${countryName}...`);
            const res = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: countryName, state: stateName })
            });
            const data = await res.json();
            this.locData.cities = !data.error ? data.data : [];
            return this.locData.cities;
        } catch (err) { return []; }
    }

    // For the Search Tab: Preloads all states and cities in a country so the user can filter easily
    async prefetchSearchDataForCountry(countryName) {
        this.searchLocData.states = [];
        this.searchLocData.cities = [];
        try {
            console.log(`🌍 [LocationAPI] Prefetching broad search data for ${countryName}...`);
            const resS = await fetch("https://countriesnow.space/api/v0.1/countries/states", { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({country: countryName})});
            const dataS = await resS.json();
            if(!dataS.error) this.searchLocData.states = dataS.data.states.map(s=>s.name);
            
            const resC = await fetch("https://countriesnow.space/api/v0.1/countries/cities", { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({country: countryName})});
            const dataC = await resC.json();
            if(!dataC.error) this.searchLocData.cities = dataC.data;
            console.log(`🌍 [LocationAPI] Cached ${this.searchLocData.states.length} states and ${this.searchLocData.cities.length} cities for searching.`);
        } catch (e) { console.error("Error prefetching:", e); }
    }
}

window.emergencyAPI = new EmergencyAPI();
