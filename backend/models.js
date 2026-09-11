const mongoose = require("mongoose");

const SchemeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    state: { type: String, default: "All India" },
    target: { type: String },
    summary: { type: String },
    benefits: [String],
    eligibility: { type: String },
    keyHighlights: [String],
    officialUrl: { type: String },
    applyUrl: { type: String }
}, { timestamps: true });

const AnalysisSchema = new mongoose.Schema({
    userId: { type: String },
    farmerName: { type: String, default: "Anonymous Farmer" },
    crop: { type: String },
    diseaseName: { type: String, required: true },
    confidence: { type: Number, required: true },
    severity: { type: String, default: "Moderate" },
    causedBy: { type: String },
    temperature: { type: Number },
    humidity: { type: Number },
    wind: { type: Number },
    latitude: { type: Number },
    longitude: { type: Number },
    district: { type: String },
    village: { type: String },
    spray: { type: String },
    sprayWarnings: [String],
    advice: [String],
    prevention: [String],
    alert: { type: String },
    timestamp: { type: Date, default: Date.now },
    imageName: { type: String }
});

const ChatMessageSchema = new mongoose.Schema({
    role: { type: String, enum: ["user", "assistant", "system"] },
    content: { type: String, required: true }
});

const ChatSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    messages: [ChatMessageSchema],
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

const PestLogSchema = new mongoose.Schema({
    userId: { type: String },
    farmerName: { type: String, default: "Anonymous Farmer" },
    crop: { type: String, default: "General" },
    pestName: { type: String, required: true },
    pestId: { type: String, required: true },
    scientificName: { type: String },
    confidence: { type: Number, default: 0.95 },
    trapCount: { type: Number, default: 0 },
    economicThreshold: { type: Number, default: 10 },
    severity: { type: String, default: "Low" },
    isEtlExceeded: { type: Boolean, default: false },
    earlierDaysCounts: [{ daysAgo: Number, count: Number }],
    forecast: { type: mongoose.Schema.Types.Mixed },
    chemicalControl: [String],
    biologicalControl: [String],
    preventiveMeasures: [String],
    imagePath: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const Scheme = mongoose.model("Scheme", SchemeSchema);
const Analysis = mongoose.model("Analysis", AnalysisSchema);
const ChatSession = mongoose.model("ChatSession", ChatSessionSchema);
const PestLog = mongoose.model("PestLog", PestLogSchema);

module.exports = { Scheme, Analysis, ChatSession, PestLog };
