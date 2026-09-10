# Agri-AI — Smart Crop Advisor Platform

Agri-AI is a high-performance, full-stack web application designed to help farmers detect crop diseases using local ML, receive personalized agricultural advisory via AI chat, and evaluate real-time weather-informed spray safety.

---

## 🛠️ Project Structure
*   **/backend**: Node.js/Express server containing the local TensorFlow.js classifier, Groq AI chat engine, and MongoDB connection.
*   **/frontend**: HTML, CSS, and vanilla JS client files served statically by the backend.

---

## 🚀 How to Run the Website

### ⚡ Quick Start (Windows)
Simply double-click **`start.bat`** in the project root folder. It will:
1. Verify your Node.js installation.
2. Automatically run `npm install` if required.
3. Start the Agri-AI server.
4. Launch your browser automatically to `http://localhost:5000`.

---

### 💻 Manual Start

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (Version 16 or higher recommended)
*   An active internet connection (for weather data and Groq AI components)

### 2. Installation
Open your terminal (PowerShell / Command Prompt) and run:
```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install
```

### 4. Run the Server
To start the application:
```bash
# From the /backend directory
npm start
```

Wait until you see:
```text
🍃 MongoDB Connected Successfully
🚀 [Agri-AI] [5/5] AI NEURAL ENGINE READY (Success!)
🚀 Agri-AI Server ready at http://127.0.0.1:5000
```

### 5. Open the Website
Open your browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## ⚙️ Model Training (Optional)
If you ever want to retrain the local crop disease classification neural network:
```bash
# In the backend directory
npm run train
```
This will train the MobileNet backbone on the local dataset found in `/backend/dataset`.