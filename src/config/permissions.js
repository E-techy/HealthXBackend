const DELEGATED_PERMISSIONS = {
    // ----------------------------------------------------
    // NUTRITION & MEALS
    // ----------------------------------------------------
    SEE_NUTRITION: {
        action: "SEE_NUTRITION",
        title: "View Nutrition Logs",
        description: "Allows the user to view your logged meals, food images, and daily calorie/nutrient intake."
    },
    EDIT_NUTRITION: {
        action: "EDIT_NUTRITION",
        title: "Log & Edit Nutrition",
        description: "Allows the user to analyze food images and log new meals on your behalf."
    },

    // ----------------------------------------------------
    // GOALS
    // ----------------------------------------------------
    SEE_GOALS: {
        action: "SEE_GOALS",
        title: "View Nutrition Goals",
        description: "Allows the user to see your active and past nutrition targets and progress."
    },
    EDIT_GOALS: {
        action: "EDIT_GOALS",
        title: "Manage Goals",
        description: "Allows the user to create, modify, or complete your nutrition goals."
    },

    // ----------------------------------------------------
    // REMINDERS
    // ----------------------------------------------------
    SEE_REMINDERS: {
        action: "SEE_REMINDERS",
        title: "View Reminders",
        description: "Allows the user to view your scheduled health, hydration, and medication reminders."
    },
    EDIT_REMINDERS: {
        action: "EDIT_REMINDERS",
        title: "Manage Reminders",
        description: "Allows the user to create, update, sync, and delete your reminders."
    },

    // ----------------------------------------------------
    // SETTINGS
    // ----------------------------------------------------
    SEE_SETTINGS: {
        action: "SEE_SETTINGS",
        title: "View Profile Settings",
        description: "Allows the user to view your app preferences and basic profile settings."
    },
    EDIT_SETTINGS: {
        action: "EDIT_SETTINGS",
        title: "Edit Settings",
        description: "Allows the user to modify your app preferences and profile configurations."
    },

    // ----------------------------------------------------
    // SUBSCRIPTIONS (READ-ONLY)
    // ----------------------------------------------------
    SEE_SUBSCRIPTION: {
        action: "SEE_SUBSCRIPTION",
        title: "View Subscription Status",
        description: "Allows the user to see if you are on a FREE, PRO, or ULTRA tier."
    },

    // ----------------------------------------------------
    // WILDCARD (MASTER ACCESS)
    // ----------------------------------------------------
    ALL: {
        action: "ALL",
        title: "Full Access",
        description: "Grants complete view and edit access to all supported health and settings data."
    }
};

module.exports = DELEGATED_PERMISSIONS;