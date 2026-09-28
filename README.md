# Agri-AI — Smart Crop Advisor Platform

> # 🌐 LIVE DEMO LINK (JURY REVIEW):
> # 🚀 **[👉 https://agri-ai-red.vercel.app/ 👈](https://agri-ai-red.vercel.app/)**
> 
> [![Live Demo](https://img.shields.io/badge/LIVE%20PROJECT-CLICK%20TO%20OPEN%20WEBSITE-2ea44f?style=for-the-badge&logo=vercel&logoColor=white)](https://agri-ai-red.vercel.app/)

---

Agri-AI is a high-performance, full-stack web application designed to help farmers detect crop diseases using local ML, receive personalized agricultural advisory via AI chat, and evaluate real-time weather-informed spray safety.

---

## 🛠️ Project Structure
*   **/client**: Modern React (Vite) frontend application with interactive GIS outbreak mapping, disease detection camera UI, follow-up timelines, and multilingual support.
*   **/backend**: Node.js/Express REST API server containing local TensorFlow.js ML disease/pest classifiers, Groq AI chat engine, PostgreSQL database, and cloud storage.
*   **/frontend**: Legacy static HTML/CSS/JS client (fallback).

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