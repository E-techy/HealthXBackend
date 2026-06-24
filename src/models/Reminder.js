const mongoose = require('mongoose');

// ==========================================
// 1. Reusable Sub-Schemas
// ==========================================

const DocumentAttachmentSchema = new mongoose.Schema({
    id: { type: String },
    documentType: { type: String },
    fileName: { type: String },
    remoteCloudUrl: { type: String },
    localDeviceUri: { type: String },
    fileSizeKb: { type: Number },
    downloadedAt: { type: Number } // Epoch
}, { _id: false });

const FacilityDetailsSchema = new mongoose.Schema({
    facilityId: { type: String },
    facilityName: { type: String },
    websiteUrl: { type: String },
    primaryPhone: { type: String },
    emergencyPhone: { type: String },
    physicalAddress: { type: String },
    googleMapsUrl: { type: String }
}, { _id: false });

const PharmacyDetailsSchema = new mongoose.Schema({
    pharmacyId: { type: String },
    storeName: { type: String },
    websiteUrl: { type: String },
    contactPhone: { type: String },
    physicalAddress: { type: String },
    is24Hours: { type: Boolean }
}, { _id: false });


// ==========================================
// 2. Base Reminder Schema
// ==========================================

const baseOptions = {
    discriminatorKey: 'category',
    strict: 'throw' // Forces validation errors for unknown fields
};

const reminderBaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAuth', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    triggerDateTime: { type: Number, required: true }, // Epoch timestamp
    isActive: { type: Boolean, default: true },
    
    alarmConfig: {
        audioType: { type: String },
        localAudioUri: { type: String },
        cloudAudioUrl: { type: String },
        isVibrationEnabled: { type: Boolean },
        volumeLevel: { type: Number }
    },
    
    repeatRule: {
        repeatType: { type: String },
        specificDays: [{ type: Number }],
        rangeStartDay: { type: Number },
        rangeEndDay: { type: Number },
        intervalStep: { type: Number }
    },

    // Using explicit Number types for Epoch timestamps to match Android logic natively
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() }
}, baseOptions);

// Auto-update the updatedAt epoch timestamp on saves/updates
reminderBaseSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Reminder = mongoose.model('Reminder', reminderBaseSchema);


// ==========================================
// 3. Discriminator Schemas by Category
// ==========================================

Reminder.discriminator('MEDICATION', new mongoose.Schema({
    medicineName: { type: String, required: true },
    genericName: { type: String },
    medicineForm: { type: String },
    mealTiming: { type: String },
    dosageAmount: { type: Number },
    dosageUnit: { type: String },
    specificInstructions: { type: String },
    sideEffectsToWatch: { type: String },
    contraindications: { type: String },
    prescriptionId: { type: String },
    prescribingDoctorName: { type: String },
    associatedMedicineIds: [{ type: String }],
    pharmacyDetails: PharmacyDetailsSchema,
    prescriptionDocument: DocumentAttachmentSchema
}, { strict: 'throw' }));

Reminder.discriminator('SUPPLEMENT', new mongoose.Schema({
    supplementName: { type: String, required: true },
    brandName: { type: String },
    medicineForm: { type: String },
    purpose: { type: String },
    dosageAmount: { type: Number },
    dosageUnit: { type: String },
    isWithFood: { type: Boolean },
    cycleDurationDays: { type: Number },
    breakDurationDays: { type: Number }
}, { strict: 'throw' }));

Reminder.discriminator('REFILL', new mongoose.Schema({
    medicineName: { type: String, required: true },
    rxNumber: { type: String },
    totalPillsInBottle: { type: Number },
    currentPillCount: { type: Number },
    warningThreshold: { type: Number },
    dailyConsumptionRate: { type: Number },
    pharmacyDetails: PharmacyDetailsSchema,
    autoReorderWebUrl: { type: String },
    lastRefillDate: { type: Number }
}, { strict: 'throw' }));

Reminder.discriminator('CONSULTATION', new mongoose.Schema({
    doctorName: { type: String, required: true },
    specialty: { type: String },
    doctorRegistrationId: { type: String },
    isTelehealth: { type: Boolean },
    meetingWebUrl: { type: String },
    meetingPassword: { type: String },
    facilityDetails: FacilityDetailsSchema,
    symptomsToDiscuss: { type: String },
    questionsForDoctor: { type: String },
    attachedDocuments: [DocumentAttachmentSchema]
}, { strict: 'throw' }));

Reminder.discriminator('CHECKUP', new mongoose.Schema({
    checkupPackageName: { type: String, required: true },
    facilityDetails: FacilityDetailsSchema,
    fastingRequiredHours: { type: Number },
    preCheckupInstructions: { type: String },
    checkupReports: [DocumentAttachmentSchema]
}, { strict: 'throw' }));

Reminder.discriminator('LAB_TEST', new mongoose.Schema({
    testName: { type: String, required: true },
    isHomeCollection: { type: Boolean },
    homeCollectionAddress: { type: String },
    phlebotomistName: { type: String },
    facilityDetails: FacilityDetailsSchema,
    preparationNotes: { type: String },
    expectedReportDate: { type: Number },
    labReportDocuments: [DocumentAttachmentSchema]
}, { strict: 'throw' }));

Reminder.discriminator('THERAPY', new mongoose.Schema({
    therapistName: { type: String, required: true },
    sessionType: { type: String },
    isTelehealth: { type: Boolean },
    meetingWebUrl: { type: String },
    facilityDetails: FacilityDetailsSchema,
    preSessionHomeworkNotes: { type: String },
    postSessionActionItems: { type: String },
    moodBeforeSession: { type: Number },
    moodAfterSession: { type: Number }
}, { strict: 'throw' }));

Reminder.discriminator('VACCINATION', new mongoose.Schema({
    vaccineName: { type: String, required: true },
    targetDisease: { type: String },
    manufacturerName: { type: String },
    batchNumber: { type: String },
    doseNumber: { type: Number },
    totalDosesRequired: { type: Number },
    nextDoseExpectedDate: { type: Number },
    administeredByDoctorName: { type: String },
    facilityDetails: FacilityDetailsSchema,
    vaccinationCertificate: DocumentAttachmentSchema
}, { strict: 'throw' }));

Reminder.discriminator('HYDRATION', new mongoose.Schema({
    targetVolumeMl: { type: Number, required: true },
    currentVolumeMl: { type: Number, default: 0 },
    containerSizeMl: { type: Number },
    beverageType: { type: String },
    isAutoLogOnAcknowledge: { type: Boolean }
}, { strict: 'throw' }));

Reminder.discriminator('NUTRITION', new mongoose.Schema({
    mealType: { type: String, required: true },
    targetCalories: { type: Number },
    targetProteinGrams: { type: Number },
    targetCarbsGrams: { type: Number },
    targetFatsGrams: { type: Number },
    dietaryRestriction: { type: String },
    promptFoodLog: { type: Boolean }
}, { strict: 'throw' }));

Reminder.discriminator('SLEEP', new mongoose.Schema({
    windDownTimeStart: { type: Number },
    targetWakeTime: { type: Number },
    targetSleepDurationMinutes: { type: Number },
    ambientAudioUrl: { type: String },
    promptDreamLogOnWake: { type: Boolean },
    promptSleepQualityLog: { type: Boolean }
}, { strict: 'throw' }));

Reminder.discriminator('FITNESS', new mongoose.Schema({
    workoutType: { type: String, required: true },
    targetDurationMinutes: { type: Number },
    intensityLevel: { type: String },
    location: { type: String },
    targetCaloriesBurn: { type: Number },
    referenceVideoUrl: { type: String },
    attachedRoutineDocument: DocumentAttachmentSchema
}, { strict: 'throw' }));

Reminder.discriminator('MINDFULNESS', new mongoose.Schema({
    practiceType: { type: String, required: true },
    targetDurationMinutes: { type: Number },
    guidedAudioUrl: { type: String },
    promptPrePracticeMood: { type: Boolean },
    promptPostPracticeMood: { type: Boolean }
}, { strict: 'throw' }));

Reminder.discriminator('HABIT', new mongoose.Schema({
    habitName: { type: String, required: true },
    currentStreakDays: { type: Number, default: 0 },
    longestStreakDays: { type: Number, default: 0 },
    cueContext: { type: String },
    rewardContext: { type: String },
    accountabilityPartnerEmail: { type: String }
}, { strict: 'throw' }));

Reminder.discriminator('VITALS', new mongoose.Schema({
    vitalType: { type: String, required: true },
    measurementUnit: { type: String },
    requiresEquipment: { type: Boolean },
    preparationInstructions: { type: String },
    targetNormalRangeMin: { type: Number },
    targetNormalRangeMax: { type: Number },
    promptLogToDatabase: { type: Boolean }
}, { strict: 'throw' }));

Reminder.discriminator('SYMPTOM', new mongoose.Schema({
    targetSymptom: { type: String, required: true },
    severityScaleRequired: { type: Boolean },
    promptTriggerLog: { type: Boolean },
    promptReliefActionLog: { type: Boolean },
    associatedRemedies: [{ type: String }]
}, { strict: 'throw' }));

Reminder.discriminator('CYCLE', new mongoose.Schema({
    phasePrompt: { type: String },
    expectedPeriodStartDate: { type: Number },
    isFertilityWindowWarning: { type: Boolean },
    promptFlowLog: { type: Boolean },
    promptMoodLog: { type: Boolean },
    promptPhysicalSymptomLog: { type: Boolean }
}, { strict: 'throw' }));

Reminder.discriminator('MATERNITY', new mongoose.Schema({
    currentTrimester: { type: Number },
    pregnancyWeek: { type: Number },
    taskType: { type: String },
    babyDevelopmentNotes: { type: String },
    promptContractionTimer: { type: Boolean },
    doctorOrMidwifeDetails: FacilityDetailsSchema
}, { strict: 'throw' }));

Reminder.discriminator('ELDER_CARE', new mongoose.Schema({
    elderName: { type: String, required: true },
    careTaskType: { type: String },
    caregiverInstructions: { type: String },
    emergencyContactPhone: { type: String },
    promptMoodAndComfortLog: { type: Boolean },
    attachedCarePlanDocument: DocumentAttachmentSchema
}, { strict: 'throw' }));

Reminder.discriminator('RECOVERY', new mongoose.Schema({
    conditionOrSurgeryName: { type: String, required: true },
    daysPostOp: { type: Number },
    taskType: { type: String },
    movementRestrictions: { type: String },
    promptPainLevelLog: { type: Boolean },
    promptWoundPhotoUpload: { type: Boolean },
    treatingPhysicianDetails: FacilityDetailsSchema
}, { strict: 'throw' }));

Reminder.discriminator('CUSTOM', new mongoose.Schema({
    customIconHexColor: { type: String },
    customIconName: { type: String },
    actionWebUrl: { type: String },
    customTags: [{ type: String }],
    attachedDocuments: [DocumentAttachmentSchema]
}, { strict: 'throw' }));


module.exports = Reminder;