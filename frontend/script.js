console.log("✅ Script loaded");

// Dynamically determine the backend URL based on the device accessing it
const API_BASE_URL = `http://${window.location.hostname}:5000`;

// --- Global Camera State ---
let stream = null;
let capturedFile = null;
let currentFacingMode = "environment"; // Default to back camera

// --- Helper to attach JWT token to all API calls ---
function getAuthHeaders(extraHeaders = {}) {
    const token = localStorage.getItem("agri_ai_token");
    const headers = { ...extraHeaders };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

// --- DOM Elements for Auth ---
const loginSection = document.getElementById("loginSection");
const mainContent = document.getElementById("mainContent");
const logoutBtn = document.getElementById("logoutBtn");
const userProfileBadge = document.getElementById("userProfileBadge");
const loggedUserName = document.getElementById("loggedUserName");
const loggedUserLocation = document.getElementById("loggedUserLocation");

const tabLoginBtn = document.getElementById("tabLoginBtn");
const tabRegisterBtn = document.getElementById("tabRegisterBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");

let currentUser = null;

// Switch to Login Tab
tabLoginBtn.addEventListener("click", () => {
    tabLoginBtn.classList.add("active");
    tabRegisterBtn.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    authMessage.innerText = "";
});

// Switch to Register Tab
tabRegisterBtn.addEventListener("click", () => {
    tabRegisterBtn.classList.add("active");
    tabLoginBtn.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    authMessage.innerText = "";
});

// --- Handle Farmer Login (POST /api/auth/login) ---
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authMessage.innerText = "⏳ Authenticating (तपासत आहे)...";
    authMessage.className = "auth-status-msg";

    const phone_or_email = document.getElementById("loginIdentifier").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone_or_email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            authMessage.innerText = `❌ ${data.error || "Login failed"}`;
            authMessage.className = "auth-status-msg error";
            return;
        }

        // Save JWT & user profile
        localStorage.setItem("agri_ai_token", data.token);
        localStorage.setItem("agri_ai_user", JSON.stringify(data.user));
        currentUser = data.user;

        authMessage.innerText = "✅ Login successful (लॉगिन यशस्वी)!";
        authMessage.className = "auth-status-msg success";

        setTimeout(() => {
            showMainApp(currentUser);
        }, 400);

    } catch (err) {
        console.error("Login Exception:", err);
        authMessage.innerText = "❌ Server error. Check database/connection.";
        authMessage.className = "auth-status-msg error";
    }
});

// --- Handle Farmer Registration (POST /api/auth/register) ---
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authMessage.innerText = "⏳ Creating account (खाते तयार करत आहे)...";
    authMessage.className = "auth-status-msg";

    const name = document.getElementById("regName").value.trim();
    const phone_or_email = document.getElementById("regIdentifier").value.trim();
    const password = document.getElementById("regPassword").value;
    const district = document.getElementById("regDistrict").value.trim();
    const village = document.getElementById("regVillage").value.trim();
    const role = document.getElementById("regRole").value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                phone_or_email,
                password,
                district,
                village,
                role,
                preferred_language: "mr"
            })
        });

        const data = await response.json();

        if (!response.ok) {
            authMessage.innerText = `❌ ${data.error || "Registration failed"}`;
            authMessage.className = "auth-status-msg error";
            return;
        }

        // Save JWT & user profile
        localStorage.setItem("agri_ai_token", data.token);
        localStorage.setItem("agri_ai_user", JSON.stringify(data.user));
        currentUser = data.user;

        authMessage.innerText = "✨ Account created successfully!";
        authMessage.className = "auth-status-msg success";

        setTimeout(() => {
            showMainApp(currentUser);
        }, 400);

    } catch (err) {
        console.error("Register Exception:", err);
        authMessage.innerText = "❌ Registration error. Check connection.";
        authMessage.className = "auth-status-msg error";
    }
});

// --- Check Session on Page Load (JWT Verification) ---
async function checkAuth() {
    const token = localStorage.getItem("agri_ai_token");
    const savedUserStr = localStorage.getItem("agri_ai_user");

    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            localStorage.setItem("agri_ai_user", JSON.stringify(currentUser));
            showMainApp(currentUser);
        } else {
            // Token expired or invalid
            logout();
        }
    } catch (err) {
        console.warn("⚠️ Offline or connection check, using cached user if present");
        if (savedUserStr) {
            currentUser = JSON.parse(savedUserStr);
            showMainApp(currentUser);
        }
    }
}

checkAuth();

// --- Logout ---
logoutBtn.addEventListener("click", logout);

// --- Guest Farmer Login ---
const guestLoginBtn = document.getElementById("guestLoginBtn");
if (guestLoginBtn) {
    guestLoginBtn.addEventListener("click", () => {
        currentUser = {
            id: "guest",
            name: "Guest Farmer",
            role: "farmer",
            district: "Maharashtra",
            village: "General"
        };
        localStorage.setItem("agri_ai_user", JSON.stringify(currentUser));
        showMainApp(currentUser);
    });
}

function logout() {
    localStorage.removeItem("agri_ai_token");
    localStorage.removeItem("agri_ai_user");
    localStorage.removeItem("isLoggedIn");
    location.reload();
}

function showMainApp(user) {
    loginSection.classList.add("hidden");
    mainContent.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    
    if (user) {
        userProfileBadge.classList.remove("hidden");
        const roleIcons = { farmer: "👨‍🌾", officer: "🏛️", expert: "🔬" };
        const roleIcon = roleIcons[user.role] || "👨‍🌾";
        loggedUserName.innerText = `${roleIcon} ${user.name}`;
        
        const loc = [user.village, user.district, user.state || "Maharashtra"].filter(Boolean).join(", ");
        loggedUserLocation.innerText = loc || "शेतकरी (Farmer)";
    }
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
                headers: getAuthHeaders(),
                body: formData
            });

            const data = await response.json();
            console.log("DATA:", data);

            if (!response.ok) {
                throw new Error(data.error || "Server error");
            }

            if (data.status === "uncertain" && data.closestMatch && data.closestMatch.disease) {
                document.getElementById("disease").innerText = `${data.disease} (Closest: ${data.closestMatch.disease})`;
            } else {
                document.getElementById("disease").innerText = data.disease;
            }
            const displayConf = data.confidencePercent !== undefined
                ? data.confidencePercent
                : (typeof data.confidence === "number" && data.confidence <= 1 && data.confidence > 0
                    ? (data.confidence * 100).toFixed(1)
                    : data.confidence);
            document.getElementById("confidence").innerText = displayConf + "%";
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

            // Decision highlighting & Color-coding
            const sevLower = (data.severity || "").toLowerCase();
            const sprayEl = document.getElementById("sprayDecision");
            if (sevLower.includes("critical") || sevLower.includes("severe")) {
                sprayEl.parentElement.classList.add("danger-bg");
                sprayEl.style.color = "#ff4d4d";
            } else {
                sprayEl.parentElement.classList.remove("danger-bg");
                sprayEl.style.color = "var(--primary)";
            }

            // Color-code severity display
            const severityEl = document.getElementById("severity");
            if (sevLower.includes("critical")) {
                severityEl.style.color = "#ff4d4d";
            } else if (sevLower.includes("severe")) {
                severityEl.style.color = "#ff7043";
            } else if (sevLower.includes("moderate") || sevLower.includes("major")) {
                severityEl.style.color = "#ffae42";
            } else if (sevLower.includes("mild")) {
                severityEl.style.color = "#eab308";
            } else {
                severityEl.style.color = "#10b981";
            }

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

            let botMsg = "";
            if (data.valid === false) {
                statusMsg.innerText = `⚠️ Image Quality Issue: ${data.recommendation}`;
                botMsg = `⚠️ I could not analyze this crop because the image quality is too low (${(data.issues || []).join(", ")}). Recommendation: ${data.recommendation}`;
                addChatMessage("bot", botMsg);
            } else {
                statusMsg.innerText = "✅ Analysis complete! (Local ML — No API)";
                botMsg = `I've analyzed your crop using local ML. Disease detected: ${data.disease}. ${data.description || ""} Ask me for treatment details or prevention tips!`;
                addChatMessage("bot", botMsg);
            }

            // Push context into history as a user+assistant exchange (NOT 'system')
            // Groq/OpenAI APIs reject 'system' role messages anywhere except position 0
            chatHistory.push({
                role: "user",
                content: `Scan result context: Disease detected: ${data.disease}. Severity: ${data.severity}. Symptoms: ${(data.symptoms || []).join(", ")}. Treatment: ${(data.advice || []).join(", ")}. Spray: ${data.spray} (Qty: ${data.spray_quantity}, Timing: ${data.spray_action_time}). Weather: ${data.temperature}°C, ${data.humidity}% humidity.`
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
    sendChatBtn.disabled = true;
    sendChatBtn.innerText = "...";

    try {
        const currentLang = getCurrentLanguage();
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: getAuthHeaders({ "Content-Type": "application/json" }),
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
    } finally {
        sendChatBtn.disabled = false;
        sendChatBtn.innerText = "Send";
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
        const res = await fetch(`${API_BASE_URL}/history`, {
            headers: getAuthHeaders()
        });
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
                <p style="font-size: 0.85rem; color: var(--text-muted);">${item.alert || ""}</p>
                <div class="history-stats">
                    <div class="history-stat-item">🌡️ <span>${item.temperature}&deg;C</span></div>
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
//  MAIN APP TAB SWITCHER (Advisor, Pest, History)
// ═══════════════════════════════════════════════
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.add("hidden");
            content.classList.remove("active");
        });

        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.classList.remove("hidden");
            targetContent.classList.add("active");
        }

        if (targetId === "historyTab") {
            loadHistory();
        }
    });
});

// ═══════════════════════════════════════════════
//  PEST MONITORING, EARLIER DAYS & OUTBREAK RISK FORECASTING (UPGRADED)
// ═══════════════════════════════════════════════
let pestSelectedFile = null;
let currentPestResult = null;
let pestMediaStream = null;
let pestCameraFacing = "environment";

const pestImageInput = document.getElementById("pestImageInput");
const pestFileLabel = document.getElementById("pestFileLabel");
const pestPreviewContainer = document.getElementById("pestPreviewContainer");
const pestPreviewImg = document.getElementById("pestPreviewImg");
const pestRemoveImgBtn = document.getElementById("pestRemoveImgBtn");
const pestRetakeBtn = document.getElementById("pestRetakeBtn");
const pestUploadLabel = document.getElementById("pestUploadLabel");
const detectPestBtn = document.getElementById("detectPestBtn");
const pestStatusMsg = document.getElementById("pestStatusMsg");
const manualTrapCountInput = document.getElementById("manualTrapCount");
const pestCropSelect = document.getElementById("pestCropSelect");
const past7DaysCountInput = document.getElementById("past7DaysCount");
const past3DaysCountInput = document.getElementById("past3DaysCount");

const slider7d = document.getElementById("slider7d");
const slider3d = document.getElementById("slider3d");
const sliderToday = document.getElementById("sliderToday");

// Two-way synchronization between number input and touch range slider
function syncSliderToInput(slider, input) {
    if (!slider || !input) return;
    slider.addEventListener("input", () => {
        input.value = slider.value;
        updateLiveVelocity();
    });
    input.addEventListener("input", () => {
        slider.value = input.value || 0;
        updateLiveVelocity();
    });
}
syncSliderToInput(slider7d, past7DaysCountInput);
syncSliderToInput(slider3d, past3DaysCountInput);
syncSliderToInput(sliderToday, manualTrapCountInput);

// Stepper Buttons (+ / -)
document.querySelectorAll(".stepper-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-step");
        const dir = parseInt(btn.getAttribute("data-dir"), 10) || 1;
        const targetInput = document.getElementById(targetId);
        if (targetInput) {
            let val = parseInt(targetInput.value, 10);
            if (isNaN(val)) val = 0;
            val = Math.max(0, val + dir);
            targetInput.value = val;
            targetInput.dispatchEvent(new Event("input"));
        }
    });
});

// Live Growth Velocity Preview
function updateLiveVelocity() {
    const c7Raw = past7DaysCountInput ? past7DaysCountInput.value : "";
    const c3Raw = past3DaysCountInput ? past3DaysCountInput.value : "";
    const cTRaw = manualTrapCountInput ? manualTrapCountInput.value : "0";

    const previewEl = document.getElementById("previewVelocityText");
    const previewDot = document.querySelector(".preview-dot");
    if (!previewEl) return;

    const cT = parseFloat(cTRaw) || 0;
    const c7 = c7Raw !== "" ? parseFloat(c7Raw) : null;
    const c3 = c3Raw !== "" ? parseFloat(c3Raw) : null;

    if (c7 !== null && !isNaN(c7)) {
        const diff = cT - c7;
        const daily = (diff / 7).toFixed(1);
        const sign = diff > 0 ? "+" : "";
        const rate = c7 > 0 ? Math.round((diff / c7) * 100) : (cT > 0 ? 100 : 0);
        const rateSign = rate > 0 ? "+" : "";

        if (diff > 0) {
            previewEl.innerHTML = `⚠️ Population Growth: <strong>${sign}${daily} pests/day (${rateSign}${rate}%)</strong>. Surge risk imminent!`;
            previewEl.style.color = "#fcd34d";
            if (previewDot) { previewDot.style.background = "#f59e0b"; previewDot.style.boxShadow = "0 0 8px #f59e0b"; }
        } else if (diff < 0) {
            previewEl.innerHTML = `🟢 Population Suppressed: <strong>${daily} pests/day (${rate}%)</strong>. Infestation is receding.`;
            previewEl.style.color = "#6ee7b7";
            if (previewDot) { previewDot.style.background = "#10b981"; previewDot.style.boxShadow = "0 0 8px #10b981"; }
        } else {
            previewEl.innerHTML = `⚖️ Stable Population: <strong>0.0 pests/day</strong> over 7-day monitoring window.`;
            previewEl.style.color = "#93c5fd";
            if (previewDot) { previewDot.style.background = "#3b82f6"; previewDot.style.boxShadow = "0 0 8px #3b82f6"; }
        }
    } else if (c3 !== null && !isNaN(c3)) {
        const diff = cT - c3;
        const daily = (diff / 3).toFixed(1);
        const sign = diff > 0 ? "+" : "";
        previewEl.innerHTML = `📈 3-day Growth Velocity: <strong>${sign}${daily} pests/day</strong>.`;
        previewEl.style.color = diff > 0 ? "#fcd34d" : "#6ee7b7";
    } else {
        previewEl.textContent = "Enter earlier counts above to compute instant population velocity";
        previewEl.style.color = "#93c5fd";
        if (previewDot) { previewDot.style.background = "#3b82f6"; previewDot.style.boxShadow = "0 0 8px #3b82f6"; }
    }
}

// Scenario Preset Buttons
document.querySelectorAll(".scenario-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const scenario = btn.getAttribute("data-scenario");
        if (scenario === "surge") {
            if (past7DaysCountInput) past7DaysCountInput.value = 2;
            if (past3DaysCountInput) past3DaysCountInput.value = 8;
            if (manualTrapCountInput) manualTrapCountInput.value = 22;
        } else if (scenario === "moderate") {
            if (past7DaysCountInput) past7DaysCountInput.value = 3;
            if (past3DaysCountInput) past3DaysCountInput.value = 6;
            if (manualTrapCountInput) manualTrapCountInput.value = 9;
        } else if (scenario === "declining") {
            if (past7DaysCountInput) past7DaysCountInput.value = 18;
            if (past3DaysCountInput) past3DaysCountInput.value = 8;
            if (manualTrapCountInput) manualTrapCountInput.value = 2;
        } else if (scenario === "clear") {
            if (past7DaysCountInput) past7DaysCountInput.value = "";
            if (past3DaysCountInput) past3DaysCountInput.value = "";
            if (manualTrapCountInput) manualTrapCountInput.value = 0;
        }

        if (slider7d) slider7d.value = past7DaysCountInput ? (past7DaysCountInput.value || 0) : 0;
        if (slider3d) slider3d.value = past3DaysCountInput ? (past3DaysCountInput.value || 0) : 0;
        if (sliderToday) sliderToday.value = manualTrapCountInput ? (manualTrapCountInput.value || 0) : 0;

        updateLiveVelocity();
    });
});

// File Selection
if (pestImageInput) {
    pestImageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        handlePestFile(file);
    });
}

function handlePestFile(file) {
    pestSelectedFile = file;
    if (pestFileLabel) pestFileLabel.textContent = `Selected: ${file.name}`;

    const reader = new FileReader();
    reader.onload = (e) => {
        if (pestPreviewImg) pestPreviewImg.src = e.target.result;
        if (pestPreviewContainer) pestPreviewContainer.classList.remove("hidden");
        if (pestUploadLabel) pestUploadLabel.classList.add("hidden");
    };
    reader.readAsDataURL(file);
}

// Remove File
if (pestRemoveImgBtn) {
    pestRemoveImgBtn.addEventListener("click", () => {
        pestSelectedFile = null;
        if (pestImageInput) pestImageInput.value = "";
        if (pestPreviewImg) pestPreviewImg.src = "";
        if (pestPreviewContainer) pestPreviewContainer.classList.add("hidden");
        if (pestUploadLabel) pestUploadLabel.classList.remove("hidden");
        if (pestFileLabel) pestFileLabel.textContent = "Click or drag Pest Photo to upload";
    });
}

if (pestRetakeBtn) {
    pestRetakeBtn.addEventListener("click", () => {
        if (pestImageInput) pestImageInput.click();
    });
}

// Drag and drop for pest upload box
const pestDropZone = document.getElementById("pestDropZone");
if (pestDropZone) {
    pestDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        pestDropZone.style.borderColor = "var(--primary)";
    });
    pestDropZone.addEventListener("dragleave", () => {
        pestDropZone.style.borderColor = "var(--glass-border)";
    });
    pestDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        pestDropZone.style.borderColor = "var(--glass-border)";
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handlePestFile(e.dataTransfer.files[0]);
        }
    });
}

// Live Camera Action for Pest & Trap Scanner
const openPestCameraBtn = document.getElementById("openPestCameraBtn");
const pestCameraModal = document.getElementById("pestCameraModal");
const pestCameraStream = document.getElementById("pestCameraStream");
const pestSnapPhotoBtn = document.getElementById("pestSnapPhotoBtn");
const pestFlipCameraBtn = document.getElementById("pestFlipCameraBtn");
const pestCloseCameraBtn = document.getElementById("pestCloseCameraBtn");

async function startPestCamera() {
    if (pestMediaStream) stopPestCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera feature requires a Secure Context (HTTPS) or localhost. ❌");
        return;
    }

    try {
        pestMediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: pestCameraFacing }
        });
        if (pestCameraStream) pestCameraStream.srcObject = pestMediaStream;
        if (pestCameraModal) pestCameraModal.classList.remove("hidden");
    } catch (err) {
        console.error("Pest Camera Error:", err);
        alert("Camera access denied! Check permissions and browser settings. ❌");
    }
}

function stopPestCamera() {
    if (pestMediaStream) {
        pestMediaStream.getTracks().forEach(track => track.stop());
        pestMediaStream = null;
    }
    if (pestCameraModal) pestCameraModal.classList.add("hidden");
    if (pestCameraStream) pestCameraStream.srcObject = null;
}

if (openPestCameraBtn) openPestCameraBtn.addEventListener("click", startPestCamera);
if (pestCloseCameraBtn) pestCloseCameraBtn.addEventListener("click", stopPestCamera);
if (pestFlipCameraBtn) {
    pestFlipCameraBtn.addEventListener("click", () => {
        pestCameraFacing = pestCameraFacing === "environment" ? "user" : "environment";
        startPestCamera();
    });
}

if (pestSnapPhotoBtn) {
    pestSnapPhotoBtn.addEventListener("click", () => {
        if (!pestCameraStream) return;
        const canvas = document.createElement("canvas");
        canvas.width = pestCameraStream.videoWidth || 640;
        canvas.height = pestCameraStream.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(pestCameraStream, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            const captured = new File([blob], `pest-live-${Date.now()}.jpg`, { type: "image/jpeg" });
            handlePestFile(captured);
            stopPestCamera();
        }, "image/jpeg", 0.92);
    });
}

// Pest Encyclopedia Search Filter
const pestSearchInput = document.getElementById("pestSearchInput");
if (pestSearchInput) {
    pestSearchInput.addEventListener("input", (e) => {
        const query = (e.target.value || "").toLowerCase().trim();
        document.querySelectorAll(".pest-tag-card").forEach(card => {
            const text = card.textContent.toLowerCase();
            const pestKey = card.getAttribute("data-pest") || "";
            if (!query || text.includes(query) || pestKey.includes(query)) {
                card.style.display = "flex";
            } else {
                card.style.display = "none";
            }
        });
    });
}

// Pest Encyclopedia Cards Click (Interactive Pre-fill & Simulation)
const PEST_CROP_MAP = {
    "aphids": "Mustard",
    "armyworm": "Maize",
    "beetle": "Tomato",
    "bollworm": "Cotton",
    "grasshopper": "Paddy (Rice)",
    "mites": "Chilli",
    "mosquito": "General Crop",
    "sawfly": "Mustard",
    "stem_borer": "Paddy (Rice)"
};

document.querySelectorAll(".pest-tag-card").forEach(card => {
    card.addEventListener("click", () => {
        const pestKey = card.getAttribute("data-pest");
        if (!pestKey) return;

        // Auto select corresponding crop
        if (pestCropSelect && PEST_CROP_MAP[pestKey]) {
            pestCropSelect.value = PEST_CROP_MAP[pestKey];
        }

        // Set realistic multi-day values
        if (past7DaysCountInput) { past7DaysCountInput.value = 3; if (slider7d) slider7d.value = 3; }
        if (past3DaysCountInput) { past3DaysCountInput.value = 8; if (slider3d) slider3d.value = 8; }
        if (manualTrapCountInput) { manualTrapCountInput.value = 19; if (sliderToday) sliderToday.value = 19; }
        updateLiveVelocity();

        // Create sample photo canvas
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, 400, 300);
        grad.addColorStop(0, "#0f172a");
        grad.addColorStop(1, "#1e293b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 24px Outfit, sans-serif";
        ctx.fillText(`🌾 ${pestKey.replace("_", " ").toUpperCase()}`, 30, 130);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "15px sans-serif";
        ctx.fillText("Field Trap Specimen • Ready for AI Surveillance", 30, 170);

        canvas.toBlob((blob) => {
            const fakeFile = new File([blob], `${pestKey}_trap_sample.jpg`, { type: "image/jpeg" });
            handlePestFile(fakeFile);
            if (pestFileLabel) pestFileLabel.textContent = `Sample: ${pestKey.toUpperCase()}`;
        });
    });
});

// Detect Pest Button Handler
if (detectPestBtn) {
    detectPestBtn.addEventListener("click", async () => {
        if (!pestSelectedFile) {
            pestStatusMsg.innerText = "Please select, capture, or click a pest photo sample first!";
            pestStatusMsg.style.color = "var(--accent)";
            return;
        }

        detectPestBtn.disabled = true;
        detectPestBtn.innerHTML = `<span>Forecasting Outbreak Risk...</span>`;
        pestStatusMsg.innerText = "Processing image, calculating multi-day growth velocity & risk forecast...";
        pestStatusMsg.style.color = "var(--primary-light)";

        const formData = new FormData();
        formData.append("image", pestSelectedFile);
        formData.append("crop", pestCropSelect ? pestCropSelect.value : "General Crop");
        formData.append("trapCount", manualTrapCountInput ? (manualTrapCountInput.value || 0) : 0);

        if (past3DaysCountInput && past3DaysCountInput.value !== "") {
            formData.append("past3DaysCount", past3DaysCountInput.value);
        }
        if (past7DaysCountInput && past7DaysCountInput.value !== "") {
            formData.append("past7DaysCount", past7DaysCountInput.value);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/pest/detect`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: formData
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Pest analysis failed");
            }

            currentPestResult = data;
            displayPestResults(data);
            pestStatusMsg.innerText = "✅ Pest identified & outbreak risk forecast generated!";
            pestStatusMsg.style.color = "var(--primary-light)";

            // Refresh recent history list if drawer is open
            if (pestLogsDrawerBody && !pestLogsDrawerBody.classList.contains("hidden")) {
                loadPestHistory();
            }

        } catch (err) {
            console.error("Pest detection error:", err);
            pestStatusMsg.innerText = `Error: ${err.message}`;
            pestStatusMsg.style.color = "#ef4444";
        } finally {
            detectPestBtn.disabled = false;
            detectPestBtn.innerHTML = `<span>🔍 Detect Pest Species & Forecast Outbreak Risk</span> 🚀`;
        }
    });
}

// Display Pest Detection & Trajectory Forecast Results
function displayPestResults(data) {
    const pest = data.pest;
    const info = data.infestation;
    const forecast = data.forecast || {};
    const reco = data.recommendations || {};

    const pestNameEl = document.getElementById("resPestName");
    if (pestNameEl) pestNameEl.textContent = `${pest.name} ${pest.vernacular ? "(" + pest.vernacular + ")" : ""}`;
    const pestSciEl = document.getElementById("resPestScientific");
    if (pestSciEl) pestSciEl.textContent = pest.scientificName || "Insect Pest";
    const pestConfEl = document.getElementById("resPestConfidence");
    if (pestConfEl) pestConfEl.textContent = `${Math.round(pest.confidence * 100)}% Match`;

    const badge = document.getElementById("resSeverityBadge");
    if (badge) {
        badge.textContent = info.severity;
        badge.style.color = info.statusColor;
        badge.style.background = `${info.statusColor}22`;
        badge.style.border = `1px solid ${info.statusColor}66`;
    }

    const trapCountEl = document.getElementById("resTrapCount");
    if (trapCountEl) trapCountEl.textContent = info.trapCount;
    const threshEl = document.getElementById("resThresholdLimit");
    if (threshEl) threshEl.textContent = `${info.threshold} ${info.unit}`;
    const etlSumEl = document.getElementById("resEtlSummary");
    if (etlSumEl) etlSumEl.innerHTML = info.summaryText;

    // 3-Zone Gauge Needle Positioning
    const ratio = info.threshold > 0 ? (info.trapCount / info.threshold) : 0;
    const ratioEl = document.getElementById("resEtlRatio");
    if (ratioEl) {
        ratioEl.textContent = `${ratio.toFixed(1)}x`;
        ratioEl.style.color = ratio >= 1.0 ? "#ef4444" : (ratio >= 0.5 ? "#f59e0b" : "#10b981");
    }

    const needlePercent = ratio <= 1.0 
        ? Math.max(4, ratio * 50)
        : Math.min(96, 50 + ((ratio - 1.0) / 1.5) * 46);

    const bar = document.getElementById("etlBarFill");
    if (bar) {
        bar.style.left = `${needlePercent}%`;
    }

    // Outbreak Risk Forecast
    const headlineEl = document.getElementById("resForecastHeadline");
    if (headlineEl && forecast.alertHeadline) headlineEl.textContent = forecast.alertHeadline;

    const trendEl = document.getElementById("resForecastTrend");
    if (trendEl && forecast.trend) trendEl.textContent = `${forecast.trend} — ${forecast.actionRecommendation || ""}`;

    const riskBadge = document.getElementById("resRiskBadge");
    if (riskBadge && forecast.riskLevel) {
        riskBadge.textContent = forecast.riskLevel;
        riskBadge.style.color = forecast.riskColor || "#10b981";
        riskBadge.style.background = `${forecast.riskColor || "#10b981"}22`;
        riskBadge.style.border = `1px solid ${forecast.riskColor || "#10b981"}55`;
    }

    const velEl = document.getElementById("resDailyVelocity");
    if (velEl) {
        const velSign = forecast.dailyVelocity > 0 ? "+" : "";
        velEl.textContent = `${velSign}${forecast.dailyVelocity || 0} pests/day`;
    }

    const rateEl = document.getElementById("resGrowthPercent");
    if (rateEl) {
        const rateSign = forecast.growthRatePercent > 0 ? "+" : "";
        rateEl.textContent = `${rateSign}${forecast.growthRatePercent || 0}%`;
    }

    // 5-Point Timeline Cards
    const c7d = past7DaysCountInput && past7DaysCountInput.value !== "" ? past7DaysCountInput.value : "--";
    const c3d = past3DaysCountInput && past3DaysCountInput.value !== "" ? past3DaysCountInput.value : "--";
    const cToday = info.trapCount || 0;
    const cPlus3 = forecast.projectedIn3Days !== undefined ? forecast.projectedIn3Days : "--";
    const cPlus7 = forecast.projectedIn7Days !== undefined ? forecast.projectedIn7Days : "--";

    const s7 = document.getElementById("stepCount7d");
    if (s7) s7.textContent = c7d;
    const s3 = document.getElementById("stepCount3d");
    if (s3) s3.textContent = c3d;
    const sT = document.getElementById("stepCountToday");
    if (sT) sT.textContent = cToday;
    const sP3 = document.getElementById("stepCountPlus3");
    if (sP3) sP3.textContent = cPlus3;
    const sP7 = document.getElementById("stepCountPlus7");
    if (sP7) sP7.textContent = cPlus7;

    const p3Step = sP3 ? sP3.closest(".timeline-step") : null;
    if (p3Step) {
        if (forecast.projectedIn3Days >= info.threshold) {
            p3Step.classList.add("step-critical");
        } else {
            p3Step.classList.remove("step-critical");
        }
    }

    const p7Step = sP7 ? sP7.closest(".timeline-step") : null;
    if (p7Step) {
        if (forecast.projectedIn7Days >= info.threshold) {
            p7Step.classList.add("step-critical");
        } else {
            p7Step.classList.remove("step-critical");
        }
    }

    // Draw SVG Trajectory Curve Chart
    drawTrajectorySvg(forecast, info);

    // Recommended Spray Window
    const sprayTextEl = document.getElementById("resSprayWindowText");
    if (sprayTextEl && forecast.sprayWindow) {
        sprayTextEl.innerHTML = `<strong>${forecast.sprayWindow}</strong>`;
    }

    // Continuous Surveillance Guidance
    const scoutEl = document.getElementById("resScoutInterval");
    if (scoutEl && forecast.riskLevel) {
        if (forecast.riskLevel.includes("CRITICAL") || forecast.riskLevel.includes("HIGH")) {
            scoutEl.textContent = "Immediate intervention required. Re-scout traps every 24–48 hours to evaluate knockdown efficiency.";
        } else {
            scoutEl.textContent = "Inspect traps every 48–72 hours during active vegetative/flowering phase.";
        }
    }

    // Symptoms
    const sympList = document.getElementById("resPestSymptoms");
    if (sympList) {
        sympList.innerHTML = "";
        (reco.symptoms || []).forEach(s => {
            const li = document.createElement("li");
            li.textContent = s;
            sympList.appendChild(li);
        });
    }

    // Biological Control
    const bioList = document.getElementById("resBiologicalList");
    if (bioList) {
        bioList.innerHTML = "";
        (reco.biologicalControl || []).forEach(b => {
            const li = document.createElement("li");
            li.textContent = b;
            bioList.appendChild(li);
        });
    }

    // Chemical Control
    const chemList = document.getElementById("resChemicalList");
    if (chemList) {
        chemList.innerHTML = "";
        (reco.chemicalControl || []).forEach(c => {
            const li = document.createElement("li");
            li.textContent = c;
            chemList.appendChild(li);
        });
    }

    // Cultural Prevention
    const prevList = document.getElementById("resPreventionList");
    if (prevList) {
        prevList.innerHTML = "";
        (reco.prevention || []).forEach(p => {
            const li = document.createElement("li");
            li.textContent = p;
            prevList.appendChild(li);
        });
    }
}

// Draw Smooth Interactive SVG Trajectory Curve Chart
function drawTrajectorySvg(forecast, info) {
    const svg = document.getElementById("pestTrajectorySvg");
    const gridG = document.getElementById("svgGrid");
    const pointsG = document.getElementById("svgPoints");
    const pathActual = document.getElementById("svgPathActual");
    const pathForecast = document.getElementById("svgPathForecast");
    const pathArea = document.getElementById("svgArea");
    const etlLine = document.getElementById("svgEtlLine");
    const etlLabel = document.getElementById("svgEtlLabel");

    if (!svg || !forecast || !info) return;

    const c7d = past7DaysCountInput && past7DaysCountInput.value !== "" ? parseFloat(past7DaysCountInput.value) : 0;
    const c3d = past3DaysCountInput && past3DaysCountInput.value !== "" ? parseFloat(past3DaysCountInput.value) : c7d;
    const cToday = parseFloat(info.trapCount) || 0;
    const cP3 = forecast.projectedIn3Days !== undefined ? parseFloat(forecast.projectedIn3Days) : cToday;
    const cP7 = forecast.projectedIn7Days !== undefined ? parseFloat(forecast.projectedIn7Days) : cP3;
    const threshold = parseFloat(info.threshold) || 10;

    const values = [c7d, c3d, cToday, cP3, cP7];
    const maxVal = Math.max(threshold * 1.4, ...values, 10);

    const xCoords = [60, 160, 260, 360, 460];
    const topY = 25;
    const botY = 145;

    const getY = (v) => botY - ((Math.min(maxVal, Math.max(0, v)) / maxVal) * (botY - topY));

    // Draw Gridlines
    if (gridG) {
        gridG.innerHTML = "";
        [0, 0.5, 1].forEach(fraction => {
            const gy = botY - fraction * (botY - topY);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", "40");
            line.setAttribute("y1", gy);
            line.setAttribute("x2", "480");
            line.setAttribute("y2", gy);
            line.setAttribute("stroke", "rgba(255, 255, 255, 0.08)");
            line.setAttribute("stroke-dasharray", "3,3");
            gridG.appendChild(line);

            const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            txt.setAttribute("x", "34");
            txt.setAttribute("y", gy + 3);
            txt.setAttribute("fill", "rgba(148, 163, 184, 0.6)");
            txt.setAttribute("font-size", "9");
            txt.setAttribute("text-anchor", "end");
            txt.textContent = Math.round(fraction * maxVal);
            gridG.appendChild(txt);
        });
    }

    // ETL Threshold Line
    const etlY = getY(threshold);
    if (etlLine) {
        etlLine.setAttribute("x1", "40");
        etlLine.setAttribute("y1", etlY);
        etlLine.setAttribute("x2", "480");
        etlLine.setAttribute("y2", etlY);
        etlLine.setAttribute("stroke", "#f87171");
        etlLine.setAttribute("stroke-width", "2");
        etlLine.setAttribute("stroke-dasharray", "4,4");
    }
    if (etlLabel) {
        etlLabel.setAttribute("x", "484");
        etlLabel.setAttribute("y", etlY + 3);
        etlLabel.textContent = `ETL (${threshold})`;
    }

    // Points Coordinates
    const pts = [
        { x: xCoords[0], y: getY(c7d), val: c7d, type: "actual" },
        { x: xCoords[1], y: getY(c3d), val: c3d, type: "actual" },
        { x: xCoords[2], y: getY(cToday), val: cToday, type: "today" },
        { x: xCoords[3], y: getY(cP3), val: cP3, type: "forecast" },
        { x: xCoords[4], y: getY(cP7), val: cP7, type: "forecast" }
    ];

    // Build SVG Smooth Bezier Paths
    // Actual curve: pts[0] -> pts[1] -> pts[2]
    const dActual = `M ${pts[0].x} ${pts[0].y} Q ${(pts[0].x + pts[1].x) / 2} ${(pts[0].y + pts[1].y) / 2 - 4}, ${pts[1].x} ${pts[1].y} T ${pts[2].x} ${pts[2].y}`;
    if (pathActual) pathActual.setAttribute("d", dActual);

    // Forecast curve: pts[2] -> pts[3] -> pts[4]
    const dForecast = `M ${pts[2].x} ${pts[2].y} Q ${(pts[2].x + pts[3].x) / 2} ${(pts[2].y + pts[3].y) / 2 - 4}, ${pts[3].x} ${pts[3].y} T ${pts[4].x} ${pts[4].y}`;
    if (pathForecast) {
        pathForecast.setAttribute("d", dForecast);
        const isHazard = cP7 >= threshold || cP3 >= threshold;
        pathForecast.setAttribute("stroke", isHazard ? "#ef4444" : "#f59e0b");
    }

    // Area Fill
    if (pathArea) {
        const dArea = `${dActual} L ${pts[2].x} ${pts[2].y} Q ${(pts[2].x + pts[3].x) / 2} ${(pts[2].y + pts[3].y) / 2 - 4}, ${pts[3].x} ${pts[3].y} T ${pts[4].x} ${pts[4].y} L ${pts[4].x} ${botY} L ${pts[0].x} ${botY} Z`;
        pathArea.setAttribute("d", dArea);
        const isHazard = cP7 >= threshold || cToday >= threshold;
        pathArea.setAttribute("fill", isHazard ? "url(#chartGradientHazard)" : "url(#chartGradientSafe)");
    }

    // Draw Points & Tooltip Labels
    if (pointsG) {
        pointsG.innerHTML = "";
        pts.forEach((p) => {
            const isCritical = p.val >= threshold;
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", p.x);
            circle.setAttribute("cy", p.y);
            circle.setAttribute("r", p.type === "today" ? "6" : "4.5");
            circle.setAttribute("fill", isCritical ? "#ef4444" : (p.type === "actual" ? "#3b82f6" : "#f59e0b"));
            circle.setAttribute("stroke", "#ffffff");
            circle.setAttribute("stroke-width", "2");
            pointsG.appendChild(circle);

            // Text Count Label above point
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", p.x);
            label.setAttribute("y", Math.max(12, p.y - 10));
            label.setAttribute("fill", isCritical ? "#f87171" : "#f8fafc");
            label.setAttribute("font-size", "10");
            label.setAttribute("font-weight", "bold");
            label.setAttribute("text-anchor", "middle");
            label.textContent = Math.round(p.val);
            pointsG.appendChild(label);
        });
    }
}

// IPM Tabs Switcher
const ipmBioBtn = document.getElementById("ipmBioBtn");
const ipmChemBtn = document.getElementById("ipmChemBtn");
const ipmPrevBtn = document.getElementById("ipmPrevBtn");
const ipmBioTab = document.getElementById("ipmBioTab");
const ipmChemTab = document.getElementById("ipmChemTab");
const ipmPrevTab = document.getElementById("ipmPrevTab");

if (ipmBioBtn && ipmChemBtn && ipmPrevBtn) {
    ipmBioBtn.addEventListener("click", () => switchIpm("bio"));
    ipmChemBtn.addEventListener("click", () => switchIpm("chem"));
    ipmPrevBtn.addEventListener("click", () => switchIpm("prev"));
}

function switchIpm(type) {
    [ipmBioBtn, ipmChemBtn, ipmPrevBtn].forEach(b => b && b.classList.remove("active"));
    [ipmBioTab, ipmChemTab, ipmPrevTab].forEach(t => { if (t) { t.classList.add("hidden"); t.classList.remove("active"); } });

    if (type === "bio") {
        if (ipmBioBtn) ipmBioBtn.classList.add("active");
        if (ipmBioTab) { ipmBioTab.classList.remove("hidden"); ipmBioTab.classList.add("active"); }
    } else if (type === "chem") {
        if (ipmChemBtn) ipmChemBtn.classList.add("active");
        if (ipmChemTab) { ipmChemTab.classList.remove("hidden"); ipmChemTab.classList.add("active"); }
    } else if (type === "prev") {
        if (ipmPrevBtn) ipmPrevBtn.classList.add("active");
        if (ipmPrevTab) { ipmPrevTab.classList.remove("hidden"); ipmPrevTab.classList.add("active"); }
    }
}

// Multi-Lingual TTS Voice Player
const speakPestAdviceBtn = document.getElementById("speakPestAdviceBtn");
const pestVoiceLang = document.getElementById("pestVoiceLang");
const audioVisualizer = document.getElementById("audioVisualizer");
const audioPlayText = document.getElementById("audioPlayText");
const audioPlayIcon = document.getElementById("audioPlayIcon");

if (speakPestAdviceBtn) {
    speakPestAdviceBtn.addEventListener("click", () => {
        if (!currentPestResult) {
            alert("Please detect a pest or run a simulation first! 🦗");
            return;
        }

        const pest = currentPestResult.pest || {};
        const info = currentPestResult.infestation || {};
        const forecast = currentPestResult.forecast || {};
        const lang = pestVoiceLang ? pestVoiceLang.value : "hi";

        let text = "";
        let voiceName = "Hindi Female";

        if (lang === "mr") {
            // Marathi
            text = `सापळा अहवाल: सापडलेला कीटक ${pest.name}, स्थानिक नाव ${pest.vernacular || ""}. सध्याची तीव्रता ${info.severity}. सापळ्यात ${info.trapCount} कीटक आढळले, मर्यादा ${info.threshold} आहे. ${forecast.alertHeadline || ""}. योग्य फवारणी वेळ: ${forecast.sprayWindow || ""}.`;
            voiceName = "Hindi Female";
        } else if (lang === "hi") {
            // Hindi
            text = `कीट एवं ट्रैप रिपोर्ट: पहचाना गया कीट ${pest.name} ${pest.vernacular ? "(" + pest.vernacular + ")" : ""}. वर्तमान स्थिति ${info.severity}. ट्रैप गणना ${info.trapCount} है जबकि आर्थिक दहलीज ${info.threshold} है. ${forecast.alertHeadline || ""}. अनुशंसित छिड़काव समय: ${forecast.sprayWindow || ""}.`;
            voiceName = "Hindi Female";
        } else {
            // English
            text = `Pest Surveillance Report: Identified pest is ${pest.name}. Current severity status is ${info.severity}. Observed trap count is ${info.trapCount} against economic threshold ${info.threshold}. ${forecast.alertHeadline || ""}. Spray window: ${forecast.sprayWindow || ""}.`;
            voiceName = "UK English Female";
        }

        if (audioVisualizer) audioVisualizer.classList.add("playing");
        if (audioPlayText) audioPlayText.textContent = "Speaking Advisory...";
        if (audioPlayIcon) audioPlayIcon.textContent = "🔊";

        const resetAudioUI = () => {
            if (audioVisualizer) audioVisualizer.classList.remove("playing");
            if (audioPlayText) audioPlayText.textContent = "Play Audio Advisory";
            if (audioPlayIcon) audioPlayIcon.textContent = "▶️";
        };

        if (window.responsiveVoice && responsiveVoice.voiceSupport && responsiveVoice.voiceSupport()) {
            responsiveVoice.speak(text, voiceName, {
                rate: 0.95,
                onend: resetAudioUI,
                onerror: resetAudioUI
            });
        } else if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = lang === "mr" ? "mr-IN" : (lang === "hi" ? "hi-IN" : "en-IN");
            utter.rate = 0.95;
            utter.onend = resetAudioUI;
            utter.onerror = resetAudioUI;
            window.speechSynthesis.speak(utter);
        } else {
            resetAudioUI();
            alert(text);
        }
    });
}

// Recent Field Trap Scans Drawer
const togglePestLogsBtn = document.getElementById("togglePestLogsBtn");
const pestLogsDrawerBody = document.getElementById("pestLogsDrawerBody");
const pestRecentLogsList = document.getElementById("pestRecentLogsList");

if (togglePestLogsBtn && pestLogsDrawerBody) {
    togglePestLogsBtn.addEventListener("click", () => {
        const isHidden = pestLogsDrawerBody.classList.contains("hidden");
        if (isHidden) {
            pestLogsDrawerBody.classList.remove("hidden");
            const icon = togglePestLogsBtn.querySelector(".drawer-toggle-icon");
            if (icon) icon.classList.add("open");
            loadPestHistory();
        } else {
            pestLogsDrawerBody.classList.add("hidden");
            const icon = togglePestLogsBtn.querySelector(".drawer-toggle-icon");
            if (icon) icon.classList.remove("open");
        }
    });
}

async function loadPestHistory() {
    if (!pestRecentLogsList) return;
    pestRecentLogsList.innerHTML = `
        <div class="sa-loading" style="grid-column: 1 / -1; padding: 1rem;">
            <p>Fetching recent trap scans...</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_BASE_URL}/api/pest/history`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        const logs = data.logs || [];

        if (logs.length === 0) {
            pestRecentLogsList.innerHTML = `<p class="empty-logs-text">No previous scans found. Any scan you perform will be saved here.</p>`;
            return;
        }

        pestRecentLogsList.innerHTML = "";
        logs.slice(0, 12).forEach(item => {
            const date = item.timestamp ? new Date(item.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent";
            const card = document.createElement("div");
            card.className = "log-mini-card";
            const isEtl = item.isEtlExceeded || (item.trapCount >= item.economicThreshold);
            card.innerHTML = `
                <div class="log-mini-top">
                    <strong>${item.pestName || "Pest"}</strong>
                    <span class="log-mini-date">${date}</span>
                </div>
                <div class="log-mini-stats">
                    <span>Trap: <b>${item.trapCount || 0}</b></span>
                    <span>ETL: <b>${item.economicThreshold || 10}</b></span>
                    <span style="color: ${isEtl ? '#ef4444' : '#10b981'}; font-weight: bold;">
                        ${isEtl ? '🚨 Breach' : '🟢 Safe'}
                    </span>
                </div>
            `;
            pestRecentLogsList.appendChild(card);
        });
    } catch (err) {
        pestRecentLogsList.innerHTML = `<p style="color: var(--danger); font-size: 0.8rem; padding: 0.5rem;">Could not load logs. Server running?</p>`;
    }
}
