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

// Automatic login check removed to ensure the app starts on the login page every time.
// --- Login Logic ---

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

            // Add the analysis result to chat context
            addChatMessage("bot", `I've analyzed your crop using local ML. Disease detected: ${data.disease}. ${data.description} Ask me for treatment details or prevention tips!`);

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

        // Load schemes if schemes tab clicked
        if (targetId === 'schemesTab') {
            loadSchemes();
        }
    });
});

// --- Schemes Logic ---
async function loadSchemes() {
    const grid = document.getElementById('schemesGrid');
    
    // Only load if it's currently showing "Loading..." to avoid redundant fetches
    if (grid.innerHTML.includes('Loading schemes')) {
        try {
            const response = await fetch(`${API_BASE_URL}/schemes`);
            const schemes = await response.json();
            
            grid.innerHTML = ''; // Clear loading text
            
            schemes.forEach(scheme => {
                const card = document.createElement('div');
                card.className = 'scheme-card';
                card.innerHTML = `
                    <h3>📌 ${scheme.name}</h3>
                    <div class="scheme-target">Target: ${scheme.target}</div>
                    <div class="scheme-summary">${scheme.summary}</div>
                    <div class="scheme-eligibility"><strong>Eligibility:</strong> ${scheme.eligibility}</div>
                    <a href="${scheme.officialUrl}" target="_blank" rel="noopener noreferrer" class="scheme-link">
                        🌐 Visit Official Platform
                    </a>
                `;
                grid.appendChild(card);
            });
        } catch (err) {
            console.error("Error loading schemes:", err);
            grid.innerHTML = '<p style="color:var(--danger)">❌ Failed to load schemes. Make sure backend is running.</p>';
        }
    }
}
