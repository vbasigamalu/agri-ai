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

