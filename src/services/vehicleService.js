const VehicleRegistration = require('../models/VehicleRegistration');
const EmergencySession = require('../models/EmergencySession');

// 1. Register a Global Vehicle
const registerOrUpdateVehicle = async (ownerId, vehicleData) => {
    if (vehicleData.teamMembers) {
        vehicleData.teamMembers = vehicleData.teamMembers.map(m => ({ ...m, rawSsn: m.ssn }));
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
                members: vehicleData.teamMembers
            }
        },
        { new: true, upsert: true, runValidators: true }
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
    
    // Update global location for radius searches
    if (updates.longitude && updates.latitude) {
        vehicle.lastKnownLocation = { type: 'Point', coordinates: [updates.longitude, updates.latitude] };
    }

    await vehicle.save();
    return vehicle;
};

// 5. Geospatial Radius Search (Global Public Vehicles)
const findNearbyPublicVehicles = async (longitude, latitude, radiusInKm) => {
    const radiusInMeters = radiusInKm * 1000;
    
    const vehicles = await VehicleRegistration.find({
        isPublic: true,
        lastKnownLocation: {
            $near: {
                $geometry: { type: "Point", coordinates: [longitude, latitude] },
                $maxDistance: radiusInMeters
            }
        }
    }).select('-crew.members.ssnEncrypted -ownerId'); // Protect privacy
    
    return vehicles;
};

// 6. Get Snapshot of Vehicles in a specific Emergency
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
