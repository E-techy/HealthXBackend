require('dotenv').config();
const axios = require('axios');

// Explicitly hitting port 5001 and the test endpoint
const BASE_URL = process.env.TEST_BACKEND_URL || 'http://localhost:5001/api/maps/test-compute-route';

const colors = {
    reset: "\x1b[0m", bright: "\x1b[1m", dim: "\x1b[2m", red: "\x1b[31m",
    green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", magenta: "\x1b[35m"
};

const logHeader = (title) => {
    console.log(`\n${colors.cyan}========================================================================${colors.reset}`);
    console.log(`${colors.bright} TEST RUN: ${colors.yellow}${title}${colors.reset}`);
    console.log(`${colors.cyan}========================================================================${colors.reset}`);
};

const logSummary = (resData) => {
    console.log(`\n${colors.bright}${colors.green}✔ Status: OK | DataType: [${resData.dataType}] | ClientMapType: [${resData.clientMapType}]${colors.reset}`);
    
    if (resData.data && resData.data.routes) {
        console.log(`${colors.magenta}Total Routes Returned: ${resData.data.routes.length}${colors.reset}`);
        resData.data.routes.forEach((route, idx) => {
            console.log(`  ${colors.bright}Route #${idx + 1}:${colors.reset}`);
            console.log(`    - Labels: ${route.routeLabels ? route.routeLabels.join(', ') : 'DEFAULT'}`);
            console.log(`    - Distance: ${route.distanceMeters ? (route.distanceMeters / 1000).toFixed(2) + ' km' : 'N/A'}`);
            console.log(`    - Duration: ${route.duration || 'N/A'}`);
            if (route.travelAdvisory?.fuelConsumptionMicroliters) {
                console.log(`    - Est. Fuel: ${(route.travelAdvisory.fuelConsumptionMicroliters / 1000000).toFixed(2)} Liters`);
            }
        });
    } else {
        console.log(`${colors.yellow}No route data returned by Google.${colors.reset}`);
    }
};

const logError = (error) => {
    console.log(`\n${colors.bright}${colors.red}✖ Request Failed:${colors.reset}`);
    if (error.response) {
        console.log(`  HTTP Code : ${error.response.status}`);
        // This will print EXACTLY what Google or Express complains about
        console.log(`  Response  :`, JSON.stringify(error.response.data, null, 2));
    } else {
        console.log(`  Message   : ${error.message}`);
    }
};

const testCases = [
    {
        name: "Case 1: Standard Lat/Lng Coordinates (DRIVE)",
        payload: {
            origin: { latitude: 23.3441, longitude: 85.3096 }, 
            destination: { latitude: 23.3150, longitude: 85.2890 }, 
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            mapType: "NORMAL"
        }
    },
    {
        name: "Case 2: Place IDs with Alternative Routes & Modifiers",
        payload: {
            origin: { placeId: "ChIJayOTViHY5okRRoq2kGnGg8o" }, 
            destination: { placeId: "ChIJTYKK2G3X5okRgP7BZvPQ2FU" }, 
            travelMode: "DRIVE",
            computeAlternativeRoutes: true,
            routeModifiers: { avoidTolls: true, avoidHighways: true },
            mapType: "TERRAIN"
        }
    },
    {
        name: "Case 3: Address Strings for TWO_WHEELER with Fuel Efficiency",
        payload: {
            origin: { address: "Albert Ekka Chowk, Ranchi, India" },
            destination: { address: "Birsa Munda Airport, Ranchi, India" },
            travelMode: "TWO_WHEELER",
            routingPreference: "TRAFFIC_AWARE_OPTIMAL",
            requestedReferenceRoutes: ["SHORTER_DISTANCE", "FUEL_EFFICIENT"],
            routeModifiers: { vehicleInfo: { emissionType: "GASOLINE" } },
            extraComputations: ["FUEL_CONSUMPTION"],
            mapType: "HYBRID"
        }
    },
    {
        name: "Case 4: Pedestrian Walking Route (WALK mode)",
        payload: {
            origin: { latitude: 28.6129, longitude: 77.2295 }, 
            destination: { latitude: 28.6149, longitude: 77.2090 }, 
            travelMode: "WALK",
            mapType: "SATELLITE"
        }
    },
    {
        name: "Case 5: Public Transit (TRANSIT mode with strict formatting)",
        payload: {
            origin: { address: "Humberto Delgado Airport, Lisbon, Portugal" },
            destination: { address: "Praça da Estrela, Lisbon, Portugal" },
            travelMode: "TRANSIT",
            computeAlternativeRoutes: true,
            transitPreferences: {
                routingPreference: "LESS_WALKING",
                allowedTravelModes: ["SUBWAY", "TRAIN", "BUS"]
            },
            mapType: "NORMAL"
        }
    },
    {
        name: "Case 6: Intentional Error Validation (Missing Required Parameters)",
        payload: {
            destination: { latitude: 23.3441, longitude: 85.3096 },
            travelMode: "BICYCLE"
        }
    }
];

const runTests = async () => {
    console.log(`${colors.bright}${colors.magenta}Starting Routes API Verification Suite...${colors.reset}`);
    console.log(`${colors.dim}Target Endpoint: ${BASE_URL}${colors.reset}\n`);
    
    for (const test of testCases) {
        logHeader(test.name);
        try {
            const response = await axios.post(BASE_URL, test.payload);
            logSummary(response.data);
        } catch (error) {
            logError(error);
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
};

runTests();