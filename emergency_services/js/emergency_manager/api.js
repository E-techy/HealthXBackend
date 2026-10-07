(() => {
    "use strict";

    class EmergencyAPI {
        constructor() {
            this.baseUrl = window.API_BASE_URL || '';
        }

        getToken() {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; healthx_auth=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }

        getHeaders(isFormData = false) {
            const token = this.getToken();
            const headers = {};
            if (!isFormData) headers['Content-Type'] = 'application/json';
            if (token) headers['Authorization'] = `Bearer ${token}`;
            return headers;
        }

        async uploadFiles(formData) {
            console.log("📤 [EM API] POST /api/emergency/upload");
            const res = await fetch(`${this.baseUrl}/api/emergency/upload`, {
                method: 'POST',
                headers: this.getHeaders(true), // true = don't set content-type, let browser set boundary
                body: formData
            });
            return await res.json();
        }

        async createEmergency(payload) {
            console.log("📤 [EM API] POST /api/emergency/create", payload);
            const res = await fetch(`${this.baseUrl}/api/emergency/create`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });
            return await res.json();
        }

        async searchEmergencies(filters) {
            const params = new URLSearchParams(filters);
            console.log(`📤 [EM API] GET /api/emergency/search?${params.toString()}`);
            const res = await fetch(`${this.baseUrl}/api/emergency/search?${params.toString()}`);
            return await res.json();
        }

        async joinEmergency(trackingId, password) {
            const res = await fetch(`${this.baseUrl}/api/emergency/join/credentials`, {
                method: 'POST', headers: this.getHeaders(),
                body: JSON.stringify({ emergencyTrackingId: trackingId, password })
            });
            return await res.json();
        }

        // --- Location APIs ---
        async fetchCountries() {
            const res = await fetch("https://countriesnow.space/api/v0.1/countries/positions");
            const data = await res.json();
            return data.error ? [] : data.data.map(c => c.name);
        }

        async fetchStates(country) {
            const res = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country })
            });
            const data = await res.json();
            return data.error ? [] : data.data.states.map(s => s.name);
        }

        async fetchCities(country, state) {
            const res = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country, state })
            });
            const data = await res.json();
            return data.error ? [] : data.data;
        }
    }

    window.EmAPI = new EmergencyAPI();
})();
