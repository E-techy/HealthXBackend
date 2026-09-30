// A simple Publish/Subscribe Event Bus to decouple our scripts
class GlobalEventBus {
    constructor() {
        this.events = {};
    }

    // Listen for an event
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }

    // Broadcast an event to anyone listening
    emit(eventName, data = {}) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error);
                }
            });
        }
    }
}

// Attach it to the window object so all scripts can talk to each other
window.EventBus = new GlobalEventBus();