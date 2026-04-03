console.log("✅ Script loaded");

// Dynamically determine the backend URL based on the device accessing it
const API_BASE_URL = `http://${window.location.hostname}:5000`;

// --- Global Camera State ---
let stream = null;
let capturedFile = null;
let currentFacingMode = "environment"; // Default to back camera

// --- Login Logic ---
const loginSection = document.getElementById("loginSection");
const mainContent = document.getElementById("mainContent");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginError = document.getElementById("loginError");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

// Check if already logged in
if (localStorage.getItem("isLoggedIn") === "true") {
    showMainApp();
}

loginBtn.addEventListener("click", () => {
    const user = usernameInput.value;
    const pass = passwordInput.value;

    // Simple demo credentials - in real app, these should be checked via backend
    if (user === "vishnu" && pass === "123456") {
        localStorage.setItem("isLoggedIn", "true");
        showMainApp();
    } else {
        loginError.innerText = "❌ Invalid Farmer ID or Password";
    }
});

logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("isLoggedIn");
    location.reload(); // Simple way to reset everything
});

function showMainApp() {
    loginSection.classList.add("hidden");
    mainContent.classList.remove("hidden");
}

// --- Main App Logic ---

const analyzeBtn = document.getElementById("analyzeBtn");
const imageInput = document.getElementById("imageInput");
const statusMsg = document.getElementById("statusMsg");


analyzeBtn.addEventListener("click", async () => {
    console.log("🔥 Button clicked");
    const file = imageInput.files[0];

    if (!file) {
        alert("Select image first ❌");
        return;
    }

    statusMsg.innerText = "📍 Getting location...";
    analyzeBtn.disabled = true;

    const startAnalysis = async (lat, lon, locName = "Searching...") => {
        statusMsg.innerText = "🔍 Analyzing crop...";

        // Show the location name in the UI
        const locNameEl = document.getElementById("locationName");
        locNameEl.innerText = locName;

        const formData = new FormData();
        formData.append("image", file);
        formData.append("lat", lat);
        formData.append("lon", lon);
        formData.append("locationName", locName); 

        try {
            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            console.log("DATA:", data);

            if (!response.ok) {
                throw new Error(data.error || "Server error");
            }

            document.getElementById("disease").innerText = data.disease;
            document.getElementById("confidence").innerText = data.confidence + "%";
            document.getElementById("severity").innerText = data.severity;
            document.getElementById("sprayDecision").innerText = data.spray;
            document.getElementById("sprayActionTime").innerText = data.spray_action_time;
            document.getElementById("sprayQuantity").innerText = data.spray_quantity;
            document.getElementById("temperature").innerText = data.temperature + " °C";
            document.getElementById("humidity").innerText = data.humidity + " %";
            document.getElementById("alert").innerText = data.alert;

            // Decision highlighting
            const sprayEl = document.getElementById("sprayDecision");
            if (data.spray.toLowerCase().includes("immediately")) {
                sprayEl.parentElement.classList.add("danger-bg");
                sprayEl.style.color = "#ff4d4d";
            } else {
                sprayEl.parentElement.classList.remove("danger-bg");
                sprayEl.style.color = "var(--primary)";
            }

            // Optional: color-code severity
            const severityEl = document.getElementById("severity");
            severityEl.style.color = (data.severity.toLowerCase() === 'critical' || data.severity.toLowerCase() === 'high') ? '#ff4d4d' : '#ffae42';

            const adviceList = document.getElementById("adviceList");
            adviceList.innerHTML = "";
            data.advice.forEach(item => {
                const li = document.createElement("li");
                li.innerText = item;
                adviceList.appendChild(li);
            });

            statusMsg.innerText = "✅ Analysis complete!";
            document.querySelector(".results").scrollIntoView({ behavior: 'smooth' });


            // Add the analysis result to chat context
            addChatMessage("bot", `I've analyzed your crop. I found **${data.disease}**. ${data.description}. How can I help with the treatment?`);

        } catch (err) {
            console.error("FETCH ERROR:", err);
            statusMsg.innerText = "❌ Error: " + err.message;
            alert("Analysis failed: " + err.message + " (Make sure backend is running) ❌");
        } finally {
            analyzeBtn.disabled = false;
        }
    };

    async function getAddressFromCoords(lat, lon) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            return data.display_name || "Unknown Location";
        } catch (err) {
            console.error("Geocoding error:", err);
            return "Unknown Location";
        }
    }

    // New: Helper to convert EXIF degrees/minutes/seconds to decimals
    function convertDMSToDecimal(dms, ref) {
        if (!dms || dms.length < 3) return null;

        let degrees = dms[0].numerator ? (dms[0].numerator / dms[0].denominator) : Number(dms[0]);
        let minutes = dms[1].numerator ? (dms[1].numerator / dms[1].denominator) : Number(dms[1]);
        let seconds = dms[2].numerator ? (dms[2].numerator / dms[2].denominator) : Number(dms[2]);

        let decimal = degrees + (minutes / 60) + (seconds / 3600);
        if (ref === "S" || ref === "W") decimal *= -1;
        return decimal;
    }

    async function detectLocation() {
        statusMsg.innerText = "📍 Detecting crop location...";

        // 1. Try Image EXIF Data (Most accurate for 'crop location')
        try {
            const exifData = await new Promise((resolve) => {
                EXIF.getData(file, function () {
                    resolve(EXIF.getAllTags(this));
                });
            });

            console.log("Raw Image Data (EXIF):", exifData);

            if (exifData.GPSLatitude && exifData.GPSLongitude) {
                const lat = convertDMSToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef);
                const lon = convertDMSToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef);
                console.log(`📍 Found GPS in Image: Lat ${lat}, Lon ${lon}`);
                const name = await getAddressFromCoords(lat, lon);
                startAnalysis(lat, lon, name + " (From Image GPS)");
                return;
            } else {
                console.log("⚠️ This image does NOT have GPS location data.");
                const rawInput = prompt("No location in image. Please enter your City/Village/District name:", "Delhi");
                
                if (!rawInput) {
                    startAnalysis(null, null, "Delhi (Default)");
                    return;
                }

                statusMsg.innerText = `🔍 Validating location: ${rawInput}...`;
                try {
                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawInput)}&limit=1`);
                    const geoData = await geoRes.json();
                    
                    if (geoData && geoData.length > 0) {
                        const validatedName = geoData[0].display_name.split(',')[0]; // Get city name
                        const lat = geoData[0].lat;
                        const lon = geoData[0].lon;
                        console.log(`✅ Validated Location: ${validatedName} (${lat}, ${lon})`);
                        startAnalysis(lat, lon, validatedName + " (Manual)");
                    } else {
                        alert(`❌ Unable to find '${rawInput}'. We'll use Delhi for weather data.`);
                        startAnalysis(28.6139, 77.2090, "Delhi (Fallback)");
                    }
                } catch (err) {
                    console.warn("Geocoding validation failed:", err);
                    startAnalysis(null, null, rawInput + " (Manual-Unverified)");
                }
                return;
            }
        } catch (e) {
            console.warn("Could not read EXIF data:", e);
        }

        // 2. Fallback to Browser Geolocation
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const name = await getAddressFromCoords(lat, lon);
                    console.log("📍 Location detected from Browser GPS:", name);
                    startAnalysis(lat, lon, name + " (From Device GPS)");
                },
                async (error) => {
                    console.warn("Geolocation failed:", error.message);
                    const fallbackCity = prompt("Location detection failed. Enter the city/village where this crop is located:", "Delhi");
                    startAnalysis(null, null, (fallbackCity || "Delhi") + " (Manual)");
                },
                { timeout: 8000 }
            );
        } else {
            startAnalysis(28.6139, 77.2090, "Delhi (Manual Mode)");
        }
    }

    detectLocation();
});

// Manual Location Change Listener
document.getElementById("changeLocBtn").addEventListener("click", async () => {
    const newLoc = prompt("Enter the correct location name (City/Village):");
    if (newLoc) {
        document.getElementById("locationName").innerText = newLoc + " (Updating...)";
        // Re-run the analysis with only the location update (simplified for now)
        alert("Location updated! Please re-analyze to refresh weather data.");
    }
});

// --- Chatbot Frontend Logic ---
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
let chatHistory = [];

function addChatMessage(role, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", role === "user" ? "user-msg" : "bot-msg");
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    addChatMessage("user", text);
    chatInput.value = "";

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: text,
                history: chatHistory
            })
        });

        const data = await response.json();
        if (data.answer) {
            addChatMessage("bot", data.answer);
            // Updating local history for Groq
            chatHistory.push({ role: "user", content: text });
            chatHistory.push({ role: "assistant", content: data.answer });
        }
    } catch (err) {
        addChatMessage("bot", "Oops, I'm having trouble connecting to the brain. Is the server running?");
    }
}

// --- Live Camera Action ---
const openCameraBtn = document.getElementById("openCameraBtn");
const cameraModal = document.getElementById("cameraModal");
const cameraStream = document.getElementById("cameraStream");
const snapPhotoBtn = document.getElementById("snapPhotoBtn");
const closeCameraBtn = document.getElementById("closeCameraBtn");
const flipCameraBtn = document.getElementById("flipCameraBtn");

async function startCamera() {
    if (stream) stopCamera();

    // Secure context check
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera feature requires a Secure Context (HTTPS) or localhost. ❌");
        return;
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: currentFacingMode } 
        });
        cameraStream.srcObject = stream;
        cameraModal.classList.remove("hidden");
    } catch (err) {
        console.error("Camera Error:", err);
        alert("Camera access denied! Check permissions and browser settings. ❌");
    }
}

openCameraBtn.addEventListener("click", startCamera);

flipCameraBtn.addEventListener("click", () => {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    startCamera(); // Restart stream with new mode
});

closeCameraBtn.addEventListener("click", stopCamera);

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    cameraModal.classList.add("hidden");
    cameraStream.srcObject = null;
}

snapPhotoBtn.addEventListener("click", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = cameraStream.videoWidth;
    canvas.height = cameraStream.videoHeight;
    canvas.getContext("2d").drawImage(cameraStream, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg");
    
    // Update local UI preview
    const preview = document.getElementById("imagePreview");
    preview.src = dataUrl;
    document.getElementById("imagePreviewContainer").classList.remove("hidden");
    document.getElementById("fileLabel").innerHTML = `✅ Captured from Live Camera`;

    // Create a pseudo-file object for our detection logic
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    capturedFile = new File([blob], "capture.jpg", { type: "image/jpeg" });

    // Stop camera and immediately trigger analysis
    stopCamera();
    
    // We update the global file so analyzeBtn handler picks it up
    const fileInput = document.getElementById("imageInput");
    
    // Use a DataTransfer object to mock file selection for the hidden input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(capturedFile);
    fileInput.files = dataTransfer.files;

    // Auto-click the analyze button
    analyzeBtn.click();
});

sendChatBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChat();
});

