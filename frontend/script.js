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

// Persistence check on page load
async function checkAuth() {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const savedInstanceId = localStorage.getItem("serverInstanceId");

    if (isLoggedIn === "true") {
        try {
            const res = await fetch(`${API_BASE_URL}/status`);
            const data = await res.json();
            
            // If server restarted (new instanceId), force a logout/re-login as requested
            if (savedInstanceId && data.instanceId !== savedInstanceId) {
                console.log("🔄 Server restarted. Re-authentication required.");
                logout();
                return;
            }
            
            // If match or first time, stay logged in
            localStorage.setItem("serverInstanceId", data.instanceId);
            showMainApp();
        } catch (err) {
            console.warn("⚠️ Could not verify server status. Keeping offline session.");
            showMainApp();
        }
    }
}

checkAuth();

loginBtn.addEventListener("click", () => {
    const user = usernameInput.value;
    const pass = passwordInput.value;

    if (user === "vishnu" && pass === "123456") {
        localStorage.setItem("isLoggedIn", "true");
        // Get current instance ID to lock the session to this server boot
        fetch(`${API_BASE_URL}/status`)
            .then(res => res.json())
            .then(data => {
                localStorage.setItem("serverInstanceId", data.instanceId);
                showMainApp();
            })
            .catch(() => showMainApp());
    } else {
        loginError.innerText = "❌ Invalid Farmer ID or Password";
    }
});

logoutBtn.addEventListener("click", logout);

function logout() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("serverInstanceId");
    location.reload();
}

function showMainApp() {
    loginSection.classList.add("hidden");
    mainContent.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
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

            // Show causedBy info
            const causedByEl = document.getElementById("causedBy");
            if (data.causedBy) {
                causedByEl.innerText = "Caused by: " + data.causedBy;
            }

            // Decision highlighting
            const sprayEl = document.getElementById("sprayDecision");
            if (data.severity === "Critical") {
                sprayEl.parentElement.classList.add("danger-bg");
                sprayEl.style.color = "#ff4d4d";
            } else {
                sprayEl.parentElement.classList.remove("danger-bg");
                sprayEl.style.color = "var(--primary)";
            }

            // Color-code severity
            const severityEl = document.getElementById("severity");
            const sevLower = data.severity.toLowerCase();
            severityEl.style.color = (sevLower === 'critical') ? '#ff4d4d' : (sevLower === 'major') ? '#ffae42' : '#10b981';

            // Render symptoms
            const symptomsList = document.getElementById("symptomsList");
            symptomsList.innerHTML = "";
            if (data.symptoms && data.symptoms.length > 0) {
                data.symptoms.forEach(item => {
                    const li = document.createElement("li");
                    li.innerText = item;
                    symptomsList.appendChild(li);
                });
            }

            // Render treatment advice
            const adviceList = document.getElementById("adviceList");
            adviceList.innerHTML = "";
            if (data.advice && data.advice.length > 0) {
                data.advice.forEach(item => {
                    const li = document.createElement("li");
                    li.innerText = item;
                    adviceList.appendChild(li);
                });
            }

            // Render prevention tips
            const preventionList = document.getElementById("preventionList");
            preventionList.innerHTML = "";
            if (data.prevention && data.prevention.length > 0) {
                data.prevention.forEach(item => {
                    const li = document.createElement("li");
                    li.innerText = item;
                    preventionList.appendChild(li);
                });
            }

            // Render spray safety warnings
            const warningsList = document.getElementById("sprayWarnings");
            warningsList.innerHTML = "";
            if (data.sprayWarnings && data.sprayWarnings.length > 0) {
                data.sprayWarnings.forEach(w => {
                    const li = document.createElement("li");
                    li.innerText = w;
                    warningsList.appendChild(li);
                });
            }

            statusMsg.innerText = "✅ Analysis complete! (Local ML — No API)";
            document.querySelector(".results").scrollIntoView({ behavior: 'smooth' });

            const botMsg = `I've analyzed your crop using local ML. Disease detected: ${data.disease}. ${data.description || ""} Ask me for treatment details or prevention tips!`;
            addChatMessage("bot", botMsg);

            // Push system context to chatHistory for the AI API
            chatHistory.push({
                role: "system",
                content: `The user just scanned a crop image. The local Agri-AI model detected: ${data.disease}. Severity: ${data.severity}. Symptoms: ${(data.symptoms || []).join(", ")}. Expert knowledge base: ${(data.advice || []).join(", ")}. Suggested Spray: ${data.spray} (Quantity: ${data.spray_quantity}, Timing: ${data.spray_action_time}). Weather: ${data.temperature}°C, ${data.humidity}% humidity. Respond in language: \${getCurrentLanguage()}. Give a concise and helpful response as an expert agricultural AI assistant.`
            });
            chatHistory.push({ role: "assistant", content: botMsg });

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
            // Priority 1: Try precise address down to building/street level (zoom=18)
            const preciseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`);
            if (preciseRes.ok) {
                const preciseData = await preciseRes.json();
                if (preciseData.display_name && !preciseData.error) return preciseData.display_name;
            }

            // Priority 2: If too remote for street level, try village/suburb level (zoom=14)
            const broadRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`);
            if (broadRes.ok) {
                const broadData = await broadRes.json();
                if (broadData.display_name && !broadData.error) return broadData.display_name;
            }

            // Fallback API if Nominatim fails or returns no address for the coordinates
            const resBdc = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            if (resBdc.ok) {
                const dataBdc = await resBdc.json();
                const locName = [dataBdc.locality, dataBdc.city, dataBdc.principalSubdivision].filter(Boolean).join(", ");
                if (locName) return locName;
            }

            // Ultimate fallback to coordinates
            return `Lat: ${parseFloat(lat).toFixed(4)}, Lon: ${parseFloat(lon).toFixed(4)}`;
        } catch (err) {
            console.error("Geocoding error:", err);
            return `Lat: ${parseFloat(lat).toFixed(4)}, Lon: ${parseFloat(lon).toFixed(4)}`;
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
                
                // INSTANT TRIGGER: Start AI analysis immediately with coordinates
                const tempLoc = `📍 [${lat.toFixed(4)}, ${lon.toFixed(4)}]`;
                startAnalysis(lat, lon, tempLoc);
                
                // BACKGROUND RESOLUTION: Update the address name silenty
                getAddressFromCoords(lat, lon).then(name => {
                    const locNameEl = document.getElementById("locationName");
                    if (locNameEl) locNameEl.innerText = name + " (From Image GPS)";
                });
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
                    
                    // INSTANT TRIGGER: Start AI analysis immediately with coordinates
                    const tempLoc = `📍 [${lat.toFixed(4)}, ${lon.toFixed(4)}]`;
                    startAnalysis(lat, lon, tempLoc);

                    // BACKGROUND RESOLUTION: Update the address name silenty
                    getAddressFromCoords(lat, lon).then(name => {
                        const locNameEl = document.getElementById("locationName");
                        if (locNameEl) locNameEl.innerText = name + " (From Device GPS)";
                    });
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
        const currentLang = getCurrentLanguage();
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: text,
                history: chatHistory,
                language: currentLang
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

// --- Voice Input Logic ---
const micBtn = document.getElementById("micBtn");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true; // Show results as they are being spoken
    recognition.maxAlternatives = 1;

    micBtn.addEventListener("click", () => {
        try {
            const currentLang = getCurrentLanguage();
            // Robust mapping for both English and Native names found in the widget
            const languageCodes = {
                "English": "en-IN", "english": "en-IN", "en": "en-IN",
                "Hindi": "hi-IN", "हिंदी": "hi-IN", "hi": "hi-IN",
                "Marathi": "mr-IN", "मराठी": "mr-IN", "mr": "mr-IN",
                "Punjabi": "pa-IN", "ਪੰਜਾਬੀ": "pa-IN", "pa": "pa-IN",
                "Bengali": "bn-IN", "বাংলা": "bn-IN", "bn": "bn-IN",
                "Telugu": "te-IN", "తెలుగు": "te-IN", "te": "te-IN",
                "Tamil": "ta-IN", "தமிழ்": "ta-IN", "ta": "ta-IN",
                "Kannada": "kn-IN", "ಕನ್ನಡ": "kn-IN", "kn": "kn-IN",
                "Malayalam": "ml-IN", "മലയാളം": "ml-IN", "ml": "ml-IN",
                "Gujarati": "gu-IN", "ગુજરાતી": "gu-IN", "gu": "gu-IN"
            };
            recognition.lang = languageCodes[currentLang] || "en-IN";
            console.log("🎤 Recognition Lang set to:", recognition.lang, `(From UI: "${currentLang}")`);

            recognition.start();
            micBtn.classList.add("recording");
            chatInput.placeholder = "Listening... Speak clearly now!";
        } catch (err) {
            console.warn("Recognition error:", err);
        }
    });

    recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        chatInput.value = transcript; // Live update the field
    };

    recognition.onend = () => {
        micBtn.classList.remove("recording");
        chatInput.placeholder = "Ask about treatment, soil, seeds...";
    };

    recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        micBtn.classList.remove("recording");
    };
} else {
    micBtn.style.display = "none";
}

sendChatBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChat();
});

// Helper to get current translation language from Google Translate Widget
function getCurrentLanguage() {
    // A. Check the <html> tag. Google Translate usually updates the 'lang' attribute.
    const htmlLang = document.documentElement.lang;
    if (htmlLang && htmlLang !== 'en' && htmlLang.length <= 5) return htmlLang;

    // B. Check the Simple Layout text value (it might be in native script)
    const simpleValueSpan = document.querySelector('.goog-te-menu-value span:first-child');
    if (simpleValueSpan) {
        let text = simpleValueSpan.innerText.trim();
        if (!text.includes("Select Language")) return text;
    }

    // C. Check the standard select value
    const select = document.querySelector('.goog-te-combo');
    if (select) return select.value || select.options[select.selectedIndex].text;

    return "English";
}

// --- Tabs Logic ---
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.add('hidden'));

        // Add active class to clicked
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');

        // Initialize scheme advisor if schemes tab clicked
        if (targetId === 'schemesTab') {
            initSchemeAdvisor();
        }

        // Load History if history tab clicked
        if (targetId === 'historyTab') {
            loadHistory();
        }
    });
});

async function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = `
        <div class="sa-loading" style="grid-column: 1 / -1;">
            <div class="sa-dots"><span></span><span></span><span></span></div>
            <p>Gathering your past scans from MongoDB Atlas...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_BASE_URL}/history`);
        const data = await res.json();

        if (data.length === 0) {
            list.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">No scan history found yet. Try analyzing a crop first!</p>`;
            return;
        }

        list.innerHTML = '';
        data.forEach(item => {
            const date = new Date(item.timestamp).toLocaleString();
            const confidence = Math.round(item.confidence);
            const badgeClass = confidence > 80 ? 'badge-high' : 'badge-low';
            
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-header">
                    <span class="history-date">📅 ${date}</span>
                    <span class="history-badge ${badgeClass}">${confidence}% Match</span>
                </div>
                <strong class="history-disease">${item.diseaseName}</strong>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${item.alert || ''}</p>
                <div class="history-stats">
                    <div class="history-stat-item">🌡️ <span>${item.temperature}°C</span></div>
                    <div class="history-stat-item">💧 <span>${item.humidity}%</span></div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        list.innerHTML = `<p style="color: var(--danger); text-align: center; grid-column: 1 / -1;">Failed to load history. Check if MongoDB is connected.</p>`;
    }
}

// ═══════════════════════════════════════════════
// SCHEME ADVISOR — AI-Powered Dynamic Fetch
// ═══════════════════════════════════════════════
let saHistory = []; // Conversation history for follow-ups
let saInitialized = false;

function initSchemeAdvisor() {
    if (saInitialized) return;
    saInitialized = true;

    const saInput = document.getElementById('saInput');
    const saSearchBtn = document.getElementById('saSearchBtn');
    const saMicBtn = document.getElementById('saMicBtn');

    // Search button — handles both new queries and follow-ups
    saSearchBtn.addEventListener('click', () => {
        const q = saInput.value.trim();
        if (q) sendSchemeQuery(q);
    });

    // Enter key on main input
    saInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const q = saInput.value.trim();
            if (q) sendSchemeQuery(q);
        }
    });

    // Example suggestion chips (reset history for fresh topic)
    document.querySelectorAll('.sa-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.getAttribute('data-query');
            saInput.value = q;
            saHistory = []; // Fresh search from chip
            sendSchemeQuery(q);
        });
    });

    // Voice input for scheme advisor
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
        const saRecognition = new SpeechRec();
        saRecognition.continuous = false;
        saRecognition.interimResults = true;
        saRecognition.maxAlternatives = 1;

        saMicBtn.addEventListener('click', () => {
            try {
                const currentLang = getCurrentLanguage();
                const langCodes = {
                    "English": "en-IN", "english": "en-IN", "en": "en-IN",
                    "Hindi": "hi-IN", "हिंदी": "hi-IN", "hi": "hi-IN",
                    "Marathi": "mr-IN", "मराठी": "mr-IN", "mr": "mr-IN",
                    "Punjabi": "pa-IN", "ਪੰਜਾਬੀ": "pa-IN", "pa": "pa-IN",
                    "Bengali": "bn-IN", "বাংলা": "bn-IN", "bn": "bn-IN",
                    "Telugu": "te-IN", "తెలుగు": "te-IN", "te": "te-IN",
                    "Tamil": "ta-IN", "தமிழ்": "ta-IN", "ta": "ta-IN",
                    "Kannada": "kn-IN", "ಕನ್ನಡ": "kn-IN", "kn": "kn-IN",
                    "Malayalam": "ml-IN", "മലയാളം": "ml-IN", "ml": "ml-IN",
                    "Gujarati": "gu-IN", "ગુજરાતી": "gu-IN", "gu": "gu-IN"
                };
                saRecognition.lang = langCodes[currentLang] || "en-IN";
                saRecognition.start();
                saMicBtn.classList.add('recording');
                saInput.placeholder = "🎤 Listening... Speak now!";
            } catch (err) { console.warn("SA mic error:", err); }
        });

        saRecognition.onresult = (event) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            saInput.value = transcript;
        };

        saRecognition.onend = () => {
            saMicBtn.classList.remove('recording');
            saInput.placeholder = "e.g. I have 2 acres land in Maharashtra...";
            // Auto-search after voice input completes
            const q = saInput.value.trim();
            if (q) sendSchemeQuery(q);
        };

        saRecognition.onerror = (event) => {
            console.error("SA Speech Error:", event.error);
            saMicBtn.classList.remove('recording');
            saInput.placeholder = "e.g. I have 2 acres land in Maharashtra...";
        };
    } else {
        saMicBtn.style.display = 'none';
    }
}

async function sendSchemeQuery(queryText) {
    const loading = document.getElementById('saLoading');
    const response = document.getElementById('saResponse');

    loading.classList.remove('hidden');
    response.classList.add('hidden');

    try {
        const currentLang = getCurrentLanguage();
        const res = await fetch(`${API_BASE_URL}/api/scheme-advisor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: queryText,
                history: saHistory,
                language: currentLang
            })
        });

        const data = await res.json();

        if (!res.ok) {
            // Handle Groq rate limit specifically
            if (data.error && data.error.includes("rate_limit_exceeded")) {
                throw new Error("AI is currently very busy. ⏳ Please wait 60 seconds and try again!");
            }
            throw new Error(data.error || "Server error");
        }

        // Append to history for follow-up context
        saHistory.push({ role: "user", content: queryText });
        saHistory.push({ role: "assistant", content: JSON.stringify(data) });

        renderSchemeResults(data);
        // Clear input after successful search
        document.getElementById('saInput').value = '';
    } catch (err) {
        console.error("Scheme Advisor Error:", err);
        loading.classList.add('hidden');
        response.classList.remove('hidden');
        
        // Show the error message in the UI more cleanly
        document.getElementById('saAiMessage').innerText = "🛑 " + err.message;
        document.getElementById('saSchemesList').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
                <button onclick="document.getElementById('saInput').focus()" class="mini-btn">Try again in a moment</button>
            </div>
        `;
    }
}

function renderSchemeResults(data) {
    const loading = document.getElementById('saLoading');
    const response = document.getElementById('saResponse');

    loading.classList.add('hidden');
    response.classList.remove('hidden');

    // AI Message
    document.getElementById('saAiMessage').innerText = data.aiMessage || "Here are the schemes I found for you:";

    // User Context
    const ctx = data.userContext || {};
    document.getElementById('saCtxLocation').innerText = ctx.location || "—";
    document.getElementById('saCtxLand').innerText = ctx.landSize || "—";
    document.getElementById('saCtxCategory').innerText = ctx.farmerCategory || "—";
    document.getElementById('saCtxCrop').innerText = ctx.cropType || "—";

    // Eligibility Meter (animated)
    const score = Math.min(100, Math.max(0, data.eligibilityScore || 0));
    document.getElementById('saScoreText').innerText = score + '%';
    // Delay for animation effect
    setTimeout(() => {
        document.getElementById('saScoreBar').style.width = score + '%';
    }, 100);

    // Scheme Cards
    const list = document.getElementById('saSchemesList');
    list.innerHTML = '';

    if (data.schemes && data.schemes.length > 0) {
        data.schemes.forEach(scheme => {
            const statusMap = {
                'eligible': { label: '✔ Eligible', cls: 'sa-badge-eligible' },
                'maybe': { label: '⚠ Maybe Eligible', cls: 'sa-badge-maybe' },
                'not_eligible': { label: '✘ Not Eligible', cls: 'sa-badge-not' }
            };
            const st = statusMap[scheme.status] || statusMap['maybe'];

            // Benefits pills
            const benefitsHTML = (scheme.benefits || []).map(b =>
                `<span class="sa-benefit-pill">${b}</span>`
            ).join('');

            const card = document.createElement('div');
            card.className = 'sa-scheme-card';
            card.innerHTML = `
                <div class="sa-scheme-top">
                    <div>
                        <div class="sa-scheme-name">${scheme.name}</div>
                        ${scheme.category ? `<span class="sa-scheme-category-tag">${scheme.category}</span>` : ''}
                    </div>
                    <span class="sa-badge ${st.cls}">${st.label}</span>
                </div>
                <div class="sa-scheme-benefit">${scheme.benefitSummary || ''}</div>
                ${benefitsHTML ? `<div class="sa-benefits-row">${benefitsHTML}</div>` : ''}
                <div class="sa-reason">
                    <strong>🧠 Why this scheme</strong>
                    ${scheme.reason || ''}
                </div>
                <div class="sa-actions">
                    <a href="${scheme.applyUrl || scheme.officialUrl || '#'}" target="_blank" rel="noopener noreferrer" class="sa-btn-apply">Apply Now</a>
                    <a href="${scheme.officialUrl || '#'}" target="_blank" rel="noopener noreferrer" class="sa-btn-details">View Details</a>
                </div>
            `;
            list.appendChild(card);
        });
    } else {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No schemes found. Try a different query or provide more details about your situation.</p>';
    }

    // Follow-up question
    const followUpQ = document.getElementById('saFollowUpQ');
    if (data.followUpQuestion) {
        followUpQ.innerText = '🤖 ' + data.followUpQuestion;
    } else {
        followUpQ.innerText = '🤖 Want to refine your results? Tell me more about your situation.';
    }

    // Scroll to response
    response.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
