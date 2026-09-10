# 🌾 Agri-AI — Complete Project Documentation & How It Works

Welcome to the complete, beginner-friendly guide to **Agri-AI**. This document explains **what** this project is, **how** we built it, the **technical architecture**, and the **exact approach** used across every component.

---

## 📌 1. Project Summary (What is Agri-AI?)

**Agri-AI** is a smart agricultural web platform designed for farmers, agricultural extension workers, and agronomists. It solves three critical farming challenges in one unified platform:

1. **Instant Crop Disease Detection**: Farmers upload or snap a photo of a sick leaf, and an AI model instantly identifies the disease, confidence score, symptoms, and treatment.
2. **Weather-Linked Spray Safety Advisory**: Uses real-time local weather data (temperature, humidity, wind speed) to tell farmers whether it is safe or unsafe to spray pesticides/fertilizers right now.
3. **Multilingual AI Agricultural Advisor**: An interactive AI chat assistant powered by Large Language Models (LLMs) that answers farming questions in simple language and multiple regional languages.
4. **Historical Record & Field Tracking**: Saves every diagnosis with GPS coordinates, weather conditions, and timestamps to MongoDB for long-term farm health tracking.

---

## 🏗️ 2. High-Level System Architecture

Here is how data flows through the application from the moment a farmer uploads a photo:

```mermaid
graph TD
    A[👨‍🌾 Farmer UI: Web Browser] -->|1. Leaf Photo + GPS Location| B[⚡ Node.js Express Server]
    
    subgraph "Backend Intelligence Engines"
        B -->|2. Image Buffer| C[🧠 Local TensorFlow.js Engine (WASM)]
        C -->|Feature Extractor| D[📦 MobileNet V2 Backbone]
        D -->|Classify| E[🎯 Custom Neural Network Head]
        E -->|Disease Name & Confidence| B
        
        B -->|3. Coordinates| F[🌤️ OpenWeatherMap API]
        F -->|Temp, Humidity, Wind| G[🛡️ Spray Safety Evaluator]
        G -->|Spray Advisory| B
        
        B -->|4. Farmer Question| H[🤖 Groq AI LLM Engine]
        H -->|Personalized Advisory| B
    end

    subgraph "Data Storage & Response"
        B -->|5. Save Scan & Coordinates| I[(🍃 MongoDB Database)]
        B -->|6. Unified Diagnosis JSON| A
    end
```

---

## 🔬 3. How We Built Each Component (Detailed Breakdown)

### A. Machine Learning Pipeline (Computer Vision)
* **Approach**: **Transfer Learning** using **MobileNet V2**.
  * Training a full deep neural network from scratch requires immense computing power and millions of images.
  * Instead, we use a pre-trained **MobileNet V2** model (which already understands edges, textures, and leaf shapes) as a feature extractor.
  * We built and trained a lightweight **Classification Head** (custom dense neural network) on top of MobileNet to recognize specific crop diseases.
* **Inference Engine**: `@tensorflow/tfjs` + `@tensorflow/tfjs-backend-wasm`.
  * We opted for **WebAssembly (WASM)** execution instead of heavy native C++ bindings (`tfjs-node`). This makes the application run reliably across any operating system (Windows, Linux, macOS) with near-native CPU acceleration.
* **Offline First**:
  * All model files (`model.json`, weight `.bin` shards) and MobileNet weights are stored directly on the local disk. The AI can diagnose diseases even if the server has no internet connection.

```
[Leaf Image] ➡️ Resize to 224x224 ➡️ Normalize (0 to 1) ➡️ MobileNet V2 (1280 features) ➡️ Dense Layers ➡️ Softmax (Disease Prediction)
```

---

### B. Disease Knowledgebase & Treatment Matrix (`cropDatabase.js`)
* Once a disease is recognized (e.g., *Tomato Early Blight*, *Potato Late Blight*, *Healthy Leaf*), the engine queries a local knowledge base.
* It returns structured, actionable recommendations:
  * **Common & Scientific Name**
  * **Visible Symptoms**
  * **Organic / Biological Treatments** (e.g., Neem oil, copper fungicide, bio-agents)
  * **Chemical Treatments & Recommended Dosage**
  * **Preventive Farming Practices** (crop rotation, proper spacing, drip irrigation)

---

### C. Real-Time Weather & Spray Safety Engine
* **Why this matters**: Spraying pesticides in high wind causes chemical drift onto neighboring fields; spraying before rain washes chemicals into water bodies; spraying in extreme heat causes leaf burn.
* **How it works**:
  1. The browser gets the farmer's GPS latitude and longitude (with fallback to regional defaults).
  2. The backend queries the **OpenWeatherMap API**.
  3. The backend runs the **Spray Safety Rule Engine**:
     * **Wind Speed > 15 km/h**: ⚠️ *Unsafe (Risk of chemical drift)*
     * **Temperature > 32°C**: ⚠️ *Unsafe (High evaporation & risk of leaf scorch)*
     * **Humidity < 40%**: ⚠️ *Caution (Pesticide droplets evaporate too quickly)*
     * **Rainy / Overcast**: ⚠️ *Unsafe (Chemical wash-off)*
     * **Optimal Conditions (18–28°C, Humidity 50–70%, Wind < 10 km/h)**: ✅ *Safe for Field Spraying*

---

### D. Intelligent AI Agronomist Chat (`/chat`)
* **Engine**: Powered by **Groq Cloud API** (high-speed inference on modern open models like LLaMA / Mixtral / OSS-20B).
* **System Prompting**: Configured with strict agricultural expertise context.
* **Multilingual Capability**: Responds naturally in the farmer's chosen language (English, Hindi, Marathi, Telugu, Tamil, etc.).
* **Context Awareness**: Maintains conversation history so farmers can ask follow-up questions (e.g., *"What is the organic dosage for this?"* or *"Can I mix this with fertilizer?"*).

---

### E. Database & Geocoding Layer
* **Database**: **MongoDB** connected via **Mongoose**.
* **Schemas**:
  * `Analysis`: Stores image name, predicted disease, confidence score, temperature, humidity, spray warnings, and timestamp.
  * `ChatSession`: Keeps message histories for learning and follow-up reviews.
* **Geocoding**: Uses **OpenStreetMap Nominatim Reverse Geocoding** to convert GPS coordinates `(lat, lon)` into human-readable village/city/district names.

---

### F. Frontend User Interface
* **Tech Stack**: Pure **HTML5**, **Modern CSS3**, and **Vanilla JavaScript** (no heavy framework overhead, fast loading on rural 3G/4G networks).
* **Key Features**:
  * Drag-and-drop or camera capture interface.
  * Live confidence gauge and visual risk badges.
  * Dynamic weather dashboard tile with real-time spray safety status.
  * Interactive chat widget with voice-ready structure.
  * Scan history drawer showing past crop diagnoses.

---

## 🛠️ 4. Technology Stack Summary

| Layer | Technology Used | Why We Chose It |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v18+) & Express.js | Fast asynchronous I/O, lightweight, easy API integration. |
| **AI / Machine Learning** | TensorFlow.js + WASM Backend | 100% cross-platform, no compilation errors on Windows/Linux, fast CPU inference. |
| **Computer Vision Model** | MobileNet V2 (Transfer Learning) | Lightweight (~14 MB), designed for low-latency edge/server inference. |
| **Weather API** | OpenWeatherMap REST API | Accurate real-time hyperlocal temperature, humidity, and wind metrics. |
| **Generative AI** | Groq Cloud AI API | Ultra-fast token generation for real-time agricultural farmer chat. |
| **Database** | MongoDB Atlas / Local MongoDB | Flexible JSON document storage for scan records and telemetry. |
| **Frontend** | HTML5, CSS3, JavaScript | Zero framework build steps, instant load times, clean responsive UI. |

---

## 📂 5. Folder & File Structure

```text
agri-ai/
├── backend/
│   ├── crop-disease-model/     # Trained neural network head (model.json + .bin weights)
│   ├── mobilenet_v2/           # MobileNet V2 feature extractor backbone
│   ├── dataset/                # Training images categorized by disease folders
│   ├── classifier.js           # TensorFlow WASM loader, inference & memory management
│   ├── cropDatabase.js         # Disease symptoms, IPM treatments & spray safety rules
│   ├── dataLoader.js           # Image resizing, tensor normalization & augmentation
│   ├── train.js                # Training script for transfer learning
│   ├── models.js               # MongoDB Mongoose schemas (Analysis & ChatSession)
│   ├── dbHelper.js             # Local JSON database fallback helper
│   ├── server.js               # Express API endpoints (/analyze, /chat, /history, /status)
│   └── package.json            # Node.js dependencies
│
├── frontend/
│   ├── index.html              # Main single-page web interface
│   ├── style.css               # Modern responsive styling & animations
│   └── script.js               # Frontend API calls, UI updates & chat handler
│
├── .gitignore                  # Git tracking rules
├── README.md                   # Quick-start setup instructions
└── PROJECT_OVERVIEW.md         # This comprehensive documentation file
```

---

## 🚀 6. Step-by-Step Approach Taken During Development

1. **Data Preparation & Label Mapping**: Curated balanced plant disease image datasets covering common Indian crop diseases (Potato, Tomato, Corn, Apple, Grape, Pepper, etc.).
2. **Transfer Learning Pipeline**: Extracted 1280-dimensional feature vectors using MobileNet V2 and trained a dense classification layer with softmax output.
3. **WASM Backend Optimization**: Solved platform-dependent C++ build issues by configuring pure WebAssembly binary routes for TensorFlow.js.
4. **Multi-Factor Fusion**: Combined computer vision prediction with environmental parameters (Weather API) to produce holistic farm advisories rather than just a raw disease label.
5. **Generative Agronomist Integration**: Connected Groq LLM to enable conversational advisories and localized language support.
6. **Data Persistence**: Integrated MongoDB to log all field inspections with coordinates for future spatial analysis.

---

## 🎯 7. Alignment with Hackathon (SIH) Criteria

* **Real-world Impact**: Reduces crop damage through early detection and prevents pesticide overuse through weather-informed spray checks.
* **Accessibility**: Designed for simple use on low-cost mobile phones and low-bandwidth networks.
* **Scalability**: Decoupled architecture allows adding IoT sensors, satellite imagery, or new crop models without rewriting core systems.
* **Sustainability**: Promotes Integrated Pest Management (IPM) with organic alternatives before chemical treatments.
