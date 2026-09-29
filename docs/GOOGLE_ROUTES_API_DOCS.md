# 🗺️ HealthX Google Routes API Integration

**Author:** Ashutosh Kumar Singh
**Service:** Google Routes API v2 (Compute Routes)
**Role:** Advanced routing engine for HealthX tracking, emergency services, and navigation.

---

# 1. System Overview

This module acts as a secure, intelligent proxy between the HealthX client (Android/Web) and the Google Routes API.

Because the Google Routes API has strict payload formatting rules, requires dynamically generated `X-Goog-FieldMask` headers to prevent over-billing, and restricts certain parameters based on the chosen travel mode (e.g., Transit vs. Drive), this backend service abstracts that complexity.

The client sends a flattened, highly-readable JSON payload. The backend formats the geo-coordinates, calculates the necessary Field Masks based on the requested features (like fuel consumption or transit details), enforces Google's strict compatibility rules, and returns a sanitized response with a custom `dataType` flag to dictate the frontend UI rendering logic.

---

# 2. API Routing Architecture

## **POST** `/api/maps/compute-route`

**Purpose:** Calculates paths between an origin and destination, optimized for various vehicles, traffic conditions, and routing preferences.

### Headers Required

* `Authorization`: `Bearer <JWT_TOKEN>`
* `Content-Type`: `application/json`

> **Note:** During development, a bypassed route `/api/maps/test-compute-route` is available without JWT.

---

# 3. Request Body (Input Parameters)

The backend accepts a customized JSON payload. All fields outside of `origin` and `destination` are optional and will fall back to defaults (`DRIVE`, `TRAFFIC_UNAWARE`, `METRIC`).

## 3.1 Core Parameters

| Field         | Type   | Required | Description                                                                                                                         |
| ------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `origin`      | Object | **Yes**  | The starting location (See Location Formats below).                                                                                 |
| `destination` | Object | **Yes**  | The ending location (See Location Formats below).                                                                                   |
| `mapType`     | String | No       | Used purely for frontend state management (e.g., `NORMAL`, `SATELLITE`, `TERRAIN`, `HYBRID`). Returned directly back to the client. |
| `travelMode`  | String | No       | Default: `DRIVE`. Options: `DRIVE`, `TWO_WHEELER`, `BICYCLE`, `WALK`, `TRANSIT`.                                                    |

## 3.2 Advanced Routing Options

| Field                      | Type    | Description                                                                                                                                                                               |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routingPreference`        | String  | Controls traffic calculation. Options: `TRAFFIC_UNAWARE` (Fastest server response), `TRAFFIC_AWARE` (Live traffic), `TRAFFIC_AWARE_OPTIMAL` (Highest accuracy, required for eco-routing). |
| `computeAlternativeRoutes` | Boolean | If `true`, returns up to 3 alternate routes alongside the primary route.                                                                                                                  |
| `requestedReferenceRoutes` | Array   | Ask for specific route profiles. Options: `["FUEL_EFFICIENT"]`, `["SHORTER_DISTANCE"]`.                                                                                                   |
| `extraComputations`        | Array   | Request additional math from Google. Options: `["FUEL_CONSUMPTION"]`.                                                                                                                     |
| `trafficModel`             | String  | How to interpret traffic (Requires `TRAFFIC_AWARE_OPTIMAL`). Options: `BEST_GUESS`, `OPTIMISTIC`, `PESSIMISTIC`.                                                                          |

## 3.3 Route Modifiers & Preferences

**`routeModifiers` Object** (Applies to Drive / Two-Wheeler / Bicycle):

```json
{
  "routeModifiers": {
    "avoidTolls": true,
    "avoidHighways": false,
    "avoidFerries": true,
    "vehicleInfo": {
      "emissionType": "GASOLINE"
    }
  }
}
```

> Options for `emissionType`: `DIESEL`, `GASOLINE`, `ELECTRIC`, `HYBRID`

**`transitPreferences` Object** (Applies ONLY to `TRANSIT` mode):

```json
{
  "transitPreferences": {
    "routingPreference": "LESS_WALKING",
    "allowedTravelModes": [
      "SUBWAY",
      "TRAIN",
      "BUS",
      "LIGHT_RAIL"
    ]
  }
}
```

> Options for `routingPreference`: `LESS_WALKING`, `FEWER_TRANSFERS`

---

# 4. Location Formats (Origin & Destination)

To make frontend implementation easy, the backend accepts three different flat formats for locations. The backend automatically translates these into the nested structure Google requires.

## **Option A: Latitude & Longitude (Preferred for GPS tracking)**

```json
{
  "origin": {
    "latitude": 23.3441,
    "longitude": 85.3096
  }
}
```

## **Option B: Google Place ID (Preferred for accuracy & POIs)**

```json
{
  "origin": {
    "placeId": "ChIJayOTViHY5okRRoq2kGnGg8o"
  }
}
```

## **Option C: Plain Text Address Strings**

```json
{
  "origin": {
    "address": "Albert Ekka Chowk, Ranchi, India"
  }
}
```

---

# 5. Response Structure (Outputs)

To prevent client-side crashes, the backend analyzes the Google response and attaches a `dataType` enum. The frontend should switch its UI logic based on this enum.

## Base Envelope

```json
{
  "success": true,
  "dataType": "SUCCESS_SINGLE_ROUTE",
  "clientMapType": "SATELLITE",
  "data": {
    "...": "Google Payload ..."
  }
}
```

## `dataType` Enumerations

1. **`SUCCESS_SINGLE_ROUTE`**: Route generated successfully. Only 1 path to draw.
2. **`SUCCESS_MULTIPLE_ROUTES`**: Multiple paths generated (e.g., Alternatives were requested).
3. **`SUCCESS_FALLBACK_ROUTE`**: Route generated, but Google couldn't honor a constraint (e.g., Live traffic failed, fell back to static historical data).
4. **`NO_ROUTE_FOUND`**: Impossible route (e.g., Driving from India to USA).
5. **`ERROR`**: Malformed request or Google API outage.

## Example `data.routes` Array Payload

Inside `data.routes`, you will receive an array of Route objects. The backend's dynamic field mask guarantees the following fields are returned (if applicable):

```json
{
  "routes": [
    {
      "routeLabels": [
        "DEFAULT_ROUTE",
        "FUEL_EFFICIENT"
      ],
      "distanceMeters": 7660,
      "duration": "1383s",
      "staticDuration": "1300s",
      "travelAdvisory": {
        "fuelConsumptionMicroliters": "110195"
      },
      "polyline": {
        "encodedPolyline": "gnsmC_`xgOCOFOLCLHbA@dEd@|DX..."
      },
      "legs": [
        {
          "distanceMeters": 7660,
          "duration": "1383s",
          "steps": [
            {
              "distanceMeters": 200,
              "travelMode": "DRIVE",
              "navigationInstruction": {
                "maneuver": "TURN_LEFT",
                "instructions": "Turn left toward Main Rd"
              },
              "polyline": {
                "encodedPolyline": "abc..."
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Decoding Polylines (For 3D / 2D Maps)

The `encodedPolyline` string is standard across all map views. The Android client or Web UI (Three.js/Google Maps SDK) must decode this compressed string into a coordinate array to draw the blue line.

---

# 6. Strict Google API Rules & Restrictions

The backend automatically enforces some of these rules, but the frontend must respect them when building requests to avoid `400 Bad Request` errors.

## 6.1 Transit Mode Restrictions

If `travelMode` is set to `"TRANSIT"`, the following rules **MUST** be obeyed:

* **NO Route Modifiers:** You cannot send `avoidTolls`, `avoidHighways`, or `avoidFerries`.
* **NO Routing Preferences:** You cannot send `TRAFFIC_AWARE` or `TRAFFIC_UNAWARE`.
* **NO Eco-Routing:** You cannot request `FUEL_EFFICIENT` or fuel consumption data.
* **NO Intermediate Waypoints:** Transit strictly supports Point A to Point B. (Note: Waypoints are not currently implemented in this backend wrapper).
* **Allowed:** You *can* use `transitPreferences` (e.g., `"LESS_WALKING"`).

## 6.2 Eco-Friendly Routing Requirements

To get `FUEL_EFFICIENT` routes or `FUEL_CONSUMPTION` calculations:

* `routingPreference` **MUST** be set to `"TRAFFIC_AWARE_OPTIMAL"`.
* `travelMode` **MUST** be `"DRIVE"` or `"TWO_WHEELER"`. (Two-wheeler eco routing is currently only supported in India and Indonesia).
* A `vehicleInfo.emissionType` should be provided (defaults to `GASOLINE`).

## 6.3 Shorter Distance Routing

To get `"SHORTER_DISTANCE"` routes:

* `travelMode` **MUST** be `"DRIVE"`, `"TWO_WHEELER"`, or `"BICYCLE"`.

## 6.4 Two-Wheeler Mode

* Bills at a different rate than standard DRIVE.
* May include paths where cars cannot physically fit. Ensure the UI warns the user that sidewalks or pedestrian paths might occasionally be suggested by Google.

---

# 7. Error Handling

If a request violates Google's rules or fails network validation, the backend catches the error and returns a sanitized envelope.

## Example Client Error Response

```json
{
  "success": false,
  "dataType": "ERROR",
  "message": "Origin and destination are required."
  // OR: "Google API Error: Transit travel mode is not supported with route modifiers."
}
```

The frontend should check `success === false` or `dataType === 'ERROR'` and display the `message` string directly to the user in a Snackbar or Dialog.


