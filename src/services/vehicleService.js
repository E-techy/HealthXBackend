const VehicleRegistration = require('../models/VehicleRegistration');
const EmergencySession = require('../models/EmergencySession');
const { encrypt, maskSSN } = require('../utils/cryptoUtils');
const { broadcastEvent, EVENTS } = require('../socket/socketSetup');

// 1. Register a Global Vehicle
const registerOrUpdateVehicle = async (ownerId, vehicleData) => {
    let processedMembers = [];
    if (vehicleData.teamMembers && Array.isArray(vehicleData.teamMembers)) {
        processedMembers = vehicleData.teamMembers.map(m => {
            const memberObj = { fullName: m.fullName, role: m.role };
            if (m.ssn) {
                memberObj.ssnEncrypted = encrypt(m.ssn);
                memberObj.ssnMasked = maskSSN(m.ssn);
            }
            return memberObj;
        });
    }

    const vehicle = await VehicleRegistration.findOneAndUpdate(
        { vehicleId: vehicleData.vehicleId },
        {
            ownerId,
            isPublic: vehicleData.isPublic !== undefined ? vehicleData.isPublic : false,
            identity: {
                vehicleName: vehicleData.vehicleName,
                vehicleType: vehicleData.vehicleType || 'OTHER',
                vehicleIcon: vehicleData.vehicleIcon,
                licensePlate: vehicleData.licensePlate,
                model: vehicleData.model
            },
            crew: {
                driverName: vehicleData.driverName,
                teamName: vehicleData.teamName,
                members: processedMembers
            }
        },
        { returnDocument: 'after', upsert: true, runValidators: true }
    );
    return vehicle;
};

// 2. Attach Vehicle to an Emergency
const attachToEmergency = async (vehicleId, emergencyTrackingId, ownerId) => {
    const emergency = await EmergencySession.findOne({ emergencyTrackingId: emergencyTrackingId.toUpperCase() });
    if (!emergency || emergency.status !== 'ACTIVE') throw new Error('Emergency session invalid or not active.');

    const vehicle = await VehicleRegistration.findOne({ vehicleId });
    if (!vehicle) throw new Error('Vehicle not found.');
    if (vehicle.ownerId.toString() !== ownerId.toString()) throw new Error('Only the vehicle owner can attach it to an emergency.');

    if (!vehicle.activeEmergencies.includes(emergency.emergencyTrackingId)) {
        vehicle.activeEmergencies.push(emergency.emergencyTrackingId);
        vehicle.connectionStatus = 'CONNECTED';
        await vehicle.save();

        // 🟢 BROADCAST: Vehicle joined
        const safeVehicleData = vehicle.toObject();
        if (safeVehicleData.crew && safeVehicleData.crew.members) {
            safeVehicleData.crew.members.forEach(m => delete m.ssnEncrypted);
        }
        
        broadcastEvent(emergency.emergencyTrackingId, EVENTS.VEHICLE_CONNECTED, {
            vehicle: safeVehicleData,
            message: `${vehicle.identity.vehicleName} has joined the emergency.`
        });
    }
    return vehicle;
};

// 3. Detach Vehicle from an Emergency
const detachFromEmergency = async (vehicleId, emergencyTrackingId, ownerId) => {
    const vehicle = await VehicleRegistration.findOne({ vehicleId });
    if (!vehicle) throw new Error('Vehicle not found.');
    if (vehicle.ownerId.toString() !== ownerId.toString()) throw new Error('Unauthorized.');

    vehicle.activeEmergencies = vehicle.activeEmergencies.filter(id => id !== emergencyTrackingId.toUpperCase());
    if (vehicle.activeEmergencies.length === 0) vehicle.connectionStatus = 'DISCONNECTED';
    
    await vehicle.save();

    // 🔴 BROADCAST: Vehicle left
    broadcastEvent(emergencyTrackingId, EVENTS.VEHICLE_DISCONNECTED, {
        vehicleId: vehicleId,
        message: `${vehicle.identity.vehicleName} has left the emergency.`
    });

    return vehicle;
};

// 4. Update Telemetry & Location
const updateTelemetry = async (vehicleId, ownerId, updates) => {
    const vehicle = await VehicleRegistration.findOne({ vehicleId });
    if (!vehicle) throw new Error('Vehicle not found.');
    if (vehicle.ownerId.toString() !== ownerId.toString()) throw new Error('Unauthorized.');

    if (updates.fuelPercentage !== undefined) vehicle.telemetry.fuelPercentage = updates.fuelPercentage;
    if (updates.batteryPercentage !== undefined) vehicle.telemetry.batteryPercentage = updates.batteryPercentage;
    if (updates.assignedTask !== undefined) vehicle.telemetry.assignedTask = updates.assignedTask;
    
    if (updates.longitude && updates.latitude) {
        vehicle.lastKnownLocation = { type: 'Point', coordinates: [updates.longitude, updates.latitude] };
    }

    await vehicle.save();

    // 🟡 BROADCAST: Telemetry update to all active emergencies
    vehicle.activeEmergencies.forEach(emergencyTrackingId => {
        broadcastEvent(emergencyTrackingId, EVENTS.VEHICLE_METADATA_UPDATED, {
            vehicleId: vehicleId,
            telemetry: vehicle.telemetry
        });

        // 🔥 CRITICAL ALERTS TRIGGER (e.g. Fuel under 15%)
        if (vehicle.telemetry.fuelPercentage !== undefined && vehicle.telemetry.fuelPercentage <= 15) {
            broadcastEvent(emergencyTrackingId, EVENTS.VEHICLE_CRITICAL_ALERT, {
                vehicleId: vehicleId,
                alertType: 'LOW_FUEL',
                severity: 'CRITICAL',
                message: `${vehicle.identity.vehicleName} is running critically low on fuel (${vehicle.telemetry.fuelPercentage}%).`
            });
        }
    });

    return vehicle;
};

// 5. Geospatial Radius Search
const findNearbyPublicVehicles = async (longitude, latitude, radiusInKm) => {
    const radiusInMeters = radiusInKm * 1000;
    
    const vehicles = await VehicleRegistration.find({
        isPublic: true,
        lastKnownLocation: {
            $near: {$geometry: { type: "Point", coordinates: [longitude, latitude] },
                $maxDistance: radiusInMeters
            }
        }
    }).select('-crew.members.ssnEncrypted -ownerId'); 
    
    return vehicles;
};

// 6. Get Snapshot of Vehicles
const getEmergencySnapshot = async (emergencyTrackingId) => {
    const vehicles = await VehicleRegistration.find({ 
        activeEmergencies: emergencyTrackingId.toUpperCase() 
    }).select('-crew.members.ssnEncrypted');

    return {
        emergencyTrackingId,
        activeVehiclesCount: vehicles.length,
        vehicles
    };
};

module.exports = {
    registerOrUpdateVehicle,
    attachToEmergency,
    detachFromEmergency,
    updateTelemetry,
    findNearbyPublicVehicles,
    getEmergencySnapshot
};
