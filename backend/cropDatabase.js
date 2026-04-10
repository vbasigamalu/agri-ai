/**
 * ============================================================
 * CROP DATABASE — Hardcoded Knowledge Base (38 Classes)
 * ============================================================
 * This file acts like a "C-style struct" database.
 * It contains all 38 classes of the PlantVillage dataset.
 * 
 * Each disease entry contains:
 * - symptoms: What to look for
 * - treatment: Immediate steps to take
 * - spray: Specific product, quantity, and timing
 * - prevention: Future safety steps
 * ============================================================
 */

const CROP_DATABASE = {
    // --- APPLE ---
    "Apple___Apple_scab": {
        plant: "Apple",
        displayName: "Apple Scab",
        scientificName: "Venturia inaequalis",
        causedBy: "Fungus",
        severity: "Major",
        symptoms: ["Olive-green velvety spots on leaves", "Brown corky scabs on fruit", "Leaves turning yellow and dropping early"],
        treatment: ["Rake and burn fallen leaves", "Prune to improve air circulation", "Apply fungicide immediately"],
        spray: { name: "Captan or Myclobutanil", quantity: "2.5g per Litre", timing: "Apply every 10-14 days during wet periods", interval: "10 days", safety: "Wear protective gear; do not spray 14 days before harvest" },
        prevention: ["Plant resistant varieties", "Prune trees to open the canopy", "Remove leaf litter in autumn"]
    },
    "Apple___Black_rot": {
        plant: "Apple",
        displayName: "Black Rot",
        scientificName: "Botryosphaeria obtusa",
        causedBy: "Fungus",
        severity: "Critical",
        symptoms: ["Frogeye leaf spots (small purple circles)", "Reddish-brown spots on fruit that rot", "Cankers on limbs"],
        treatment: ["Prune out all dead wood and cankers", "Remove mummified fruit from trees", "Destroy infected material"],
        spray: { name: "Thiophanate-methyl or Captan", quantity: "2g per Litre", timing: "Start at bud break through mid-summer", interval: "14 days", safety: "Toxic to fish; avoid water runoff" },
        prevention: ["Prune and remove all dead wood each winter", "Remove wild host plants like Hawthorn nearby"]
    },
    "Apple___Cedar_apple_rust": {
        plant: "Apple",
        displayName: "Cedar Apple Rust",
        scientificName: "Gymnosporangium juniperi-virginianae",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["Bright orange/yellow spots on top of leaves", "Small tube-like structures under leaves", "Stunted fruit growth"],
        treatment: ["Remove nearby Juniper/Cedar trees if possible", "Apply preventive fungicides in spring"],
        spray: { name: "Myclobutanil", quantity: "1.5ml per Litre", timing: "Pink bud stage until petal fall", interval: "7 days", safety: "Apply in low wind conditions" },
        prevention: ["Plant rust-resistant apple varieties", "Do not plant cedars within 1km of orchard"]
    },
    "Apple___healthy": {
        plant: "Apple",
        displayName: "Healthy Apple",
        scientificName: "Malus domestica",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Leaves are vibrant green", "Fruit skin is smooth and clear", "Tree shows strong growth"],
        treatment: ["Maintain regular watering schedule", "Apply balanced NPK fertilizer in spring"],
        spray: { name: "No treatment needed", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "Keep up routine maintenance" },
        prevention: ["Monitor for pests", "Ensure proper soil nutrition"]
    },

    // --- BLUEBERRY ---
    "Blueberry___healthy": {
        plant: "Blueberry",
        displayName: "Healthy Blueberry",
        scientificName: "Vaccinium corymbosum",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Green, glossy leaves", "Firm berries", "Strong upright growth"],
        treatment: ["Ensure soil pH is acidic (4.5-5.5)", "Mulch with pine needles or bark"],
        spray: { name: "No treatment needed", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Frequent scouting", "Regular acidity checks"]
    },

    // --- CHERRY ---
    "Cherry_(including_sour)___healthy": {
        plant: "Cherry",
        displayName: "Healthy Cherry",
        scientificName: "Prunus avium",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Healthy dark green leaves", "Consistent canopy growth"],
        treatment: ["Standard pruning", "Mulching"],
        spray: { name: "No treatment needed", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Proper air flow"]
    },
    "Cherry_(including_sour)___Powdery_mildew": {
        plant: "Cherry",
        displayName: "Cherry Powdery Mildew",
        scientificName: "Podosphaera clandestina",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["White powdery coating on leaves", "Culing or twisting of young leaves", "Stunted shoot growth"],
        treatment: ["Prune dense areas for airflow", "Apply sulfur based sprays early morning"],
        spray: { name: "Wettable Sulfur or Potassium Bicarbonate", quantity: "4g per Litre", timing: "At first sign of white spots", interval: "7-10 days", safety: "Do not apply sulfur if temp > 32°C" },
        prevention: ["Avoid overhead irrigation", "Selective pruning in winter"]
    },

    // --- CORN ---
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        plant: "Corn",
        displayName: "Gray Leaf Spot",
        scientificName: "Cercospora zeae-maydis",
        causedBy: "Fungus",
        severity: "Major",
        symptoms: ["Rectangular gray-brown spots", "Lesions run parallel to leaf veins", "Complete blighting of leaves"],
        treatment: ["Rotate crops out of corn for 1-2 years", "Deep tillage to bury residue"],
        spray: { name: "Azoxystrobin or Pyraclostrobin", quantity: "1.2ml per Litre", timing: "Apply at tasseling (VT stage)", interval: "Single application often sufficient", safety: "Toxic to aquatic life" },
        prevention: ["Use resistant hybrids", "Avoid continuous corn planting"]
    },
    "Corn_(maize)___Common_rust_": {
        plant: "Corn",
        displayName: "Common Rust",
        scientificName: "Puccinia sorghi",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["Small cinnamon-brown pustules on both leaf sides", "Pustules rupture to release powdery spores"],
        treatment: ["Apply foliar fungicide if infection is early", "Harvest early if lodging is common"],
        spray: { name: "Propiconazole", quantity: "1ml per Litre", timing: "When 6 pustules per leaf appear", interval: "14 days", safety: "Do not apply within 30 days of harvest" },
        prevention: ["Plant resistant hybrids", "Avoid late planting"]
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        plant: "Corn",
        displayName: "Northern Leaf Blight",
        scientificName: "Exserohilum turcicum",
        causedBy: "Fungus",
        severity: "Major",
        symptoms: ["Cigar-shaped tan lesions (1-6 inches long)", "Grayish-green water-soaked spots"],
        treatment: ["Manage crop residue", "Use foliar fungicides if economics allow"],
        spray: { name: "Mancozeb or Strobilurins", quantity: "2g per Litre", timing: "Vegetative stage through silking", interval: "10 days", safety: "Check local regulations for Mancozeb" },
        prevention: ["Crop rotation", "Management of infected debris"]
    },
    "Corn_(maize)___healthy": {
        plant: "Corn",
        displayName: "Healthy Corn",
        scientificName: "Zea mays",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Dark green broad leaves", "Uniform silk and tassel development"],
        treatment: ["Ensure adequate Nitrogen", "Deep irrigation during silking"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Balanced fertilization"]
    },

    // --- GRAPE ---
    "Grape___Black_rot": {
        plant: "Grape",
        displayName: "Grape Black Rot",
        scientificName: "Guignardia bidwellii",
        causedBy: "Fungus",
        severity: "Critical",
        symptoms: ["Small brown circular leaf spots", "Berries turn into black shriveled 'mummies'", "Small black dots (pycnidia) on berries"],
        treatment: ["Prune and remove all mummified fruit", "Remove infected canes in winter", "Destroy all trimmings"],
        spray: { name: "Mancozeb or Myclobutanil", quantity: "2g per Litre", timing: "From 1-inch shoot growth until bloom", interval: "10-14 days", safety: "Mancozeb 66-day Pre-Harvest Interval" },
        prevention: ["Full sun exposure", "Good weed control to reduce humidity"]
    },
    "Grape___Esca_(Black_Measles)": {
        plant: "Grape",
        displayName: "Esca (Black Measles)",
        scientificName: "Phaeomoniella chlamydospora",
        causedBy: "Complex Fungus",
        severity: "Major",
        symptoms: ["'Tiger stripe' yellow/brown leaf patterns", "Small dark spots on berry skins", "Sudden wilting of vines"],
        treatment: ["Prune infected arms 15cm below symptoms", "Disinfect pruning tools with 10% bleach"],
        spray: { name: "Sodium Arsenite (Restricted) or Bio-fungicides", quantity: "Variable", timing: "Winter dormant period", interval: "Annual", safety: "Very high toxicity; professional use only" },
        prevention: ["Avoid large pruning wounds during rain", "Treat wounds with fungicidal paste"]
    },
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
        plant: "Grape",
        displayName: "Grape Leaf Blight",
        scientificName: "Pseudocercospora vitis",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["Irregular reddish-brown leaf spots", "Leaf edges turn brown and dry", "Premature defoliation"],
        treatment: ["Rake and destroy fallen leaves", "Apply copper-based fungicides"],
        spray: { name: "Bordeaux mixture or Copper Oxychloride", quantity: "3g per Litre", timing: "After leaf fall and before fruit set", interval: "15 days", safety: "Do not spray in heat > 30°C" },
        prevention: ["Wider vine spacing", "Balance vines through proper pruning"]
    },
    "Grape___healthy": {
        plant: "Grape",
        displayName: "Healthy Grape",
        scientificName: "Vitis vinifera",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Clear green leaves", "Firm stems", "No spots on fruit"],
        treatment: ["Regular pruning", "Trellis maintenance"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Avoid overhead watering"]
    },

    // --- ORANGE ---
    "Orange___Haunglongbing_(Citrus_greening)": {
        plant: "Orange",
        displayName: "Citrus Greening (HLB)",
        scientificName: "Candidatus Liberibacter asiaticus",
        causedBy: "Bacteria (Asia Asian citrus psyllid)",
        severity: "Critical",
        symptoms: ["Asymmetrical yellowing of leaves (blotchy mottle)", "Small, lopsided greened fruit", "Bitter tasting juice"],
        treatment: ["Infected trees cannot be cured — remove them", "Strict control of the psyllid insect carrier"],
        spray: { name: "Imidacloprid (for insect control)", quantity: "0.5ml per Litre", timing: "During leaf flush periods", interval: "Monthly", safety: "Toxic to bees; do not spray during bloom" },
        prevention: ["Use only certified disease-free nursery stock", "Regular scouting for psyllids"]
    },

    // --- PEACH ---
    "Peach___Bacterial_spot": {
        plant: "Peach",
        displayName: "Peach Bacterial Spot",
        scientificName: "Xanthomonas campestris",
        causedBy: "Bacteria",
        severity: "Major",
        symptoms: ["Small water-soaked leaf spots", "Shot-hole appearance (spots fall out)", "Cracking fruit skin"],
        treatment: ["Avoid high Nitrogen fertilizers", "Apply copper during dormant season"],
        spray: { name: "Copper Fungicide or Oxytetracycline", quantity: "2g per Litre", timing: "Dormant, petal fall, and shuck split", interval: "7 days", safety: "Applying copper in cool/wet weather causes injury" },
        prevention: ["Plant resistant cultivars", "Good orchard sanitation"]
    },
    "Peach___healthy": {
        plant: "Peach",
        displayName: "Healthy Peach",
        scientificName: "Prunus persica",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Large lanceolate green leaves", "Smooth trunk", "No gumming"],
        treatment: ["Adequate thinning of fruit", "Winter pruning"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Prevent trunk injury"]
    },

    // --- PEPPER BELL ---
    "Pepper,_bell___Bacterial_spot": {
        plant: "Pepper",
        displayName: "Pepper Bacterial Spot",
        scientificName: "Xanthomonas euvesicatoria",
        causedBy: "Bacteria",
        severity: "Major",
        symptoms: ["Small, water-soaked, blackish spots", "Spots on fruit are raised and warty", "Leaves turn yellow and drop"],
        treatment: ["Remove infected plants immediately", "Avoid working in garden when plants are wet"],
        spray: { name: "Copper-based Bactericide", quantity: "2.5g per Litre", timing: "At first sign of spots", interval: "7-10 days", safety: "Copper accumulates in soil; use only when necessary" },
        prevention: ["Use disease-free seeds", "2-year crop rotation (no tomatoes/peppers)"]
    },
    "Pepper,_bell___healthy": {
        plant: "Pepper",
        displayName: "Healthy Bell Pepper",
        scientificName: "Capsicum annuum",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Strong stems", "Deep green foliage", "Uniform fruit shape"],
        treatment: ["Balanced watering", "Calcium boost to prevent end rot"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Proper spacing for airflow"]
    },

    // --- POTATO ---
    "Potato___Early_blight": {
        plant: "Potato",
        displayName: "Potato Early Blight",
        scientificName: "Alternaria solani",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["Bullseye-patterned brown spots on older leaves", "Yellowing of surrounding tissue", "Tubers have dark, sunken spots"],
        treatment: ["Remove lower infected leaves", "Maintain high soil fertility"],
        spray: { name: "Chlorothalonil or Mancozeb", quantity: "2g per Litre", timing: "At first sign of spots on lower leaves", interval: "7-10 days", safety: "Highly toxic to fish" },
        prevention: ["Crop rotation", "Avoid overhead irrigation"]
    },
    "Potato___Late_blight": {
        plant: "Potato",
        displayName: "Potato Late Blight",
        scientificName: "Phytophthora infestans",
        causedBy: "Fungus-like Pathogen",
        severity: "Critical",
        symptoms: ["Large dark-brown water-soaked lesions", "White fuzzy growth under leaves in humid weather", "Complete plant collapse in days"],
        treatment: ["Destroy all infected plants (Do NOT compost)", "Spray preventive fungicides to surrounding plants"],
        spray: { name: "Ridomil Gold or Copper Fungicide", quantity: "3g per Litre", timing: "Immediately when detected in area", interval: "5-7 days during damp weather", safety: "Handle with extreme care; wash all tools" },
        prevention: ["Plant certified disease-free tubers", "Monitor weather (Blight Alerts)"]
    },
    "Potato___healthy": {
        plant: "Potato",
        displayName: "Healthy Potato",
        scientificName: "Solanum tuberosum",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Strong bushy growth", "Vibrant green canopy"],
        treatment: ["Regular hilling", "Moderate Nitrogen"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Soil health maintenance"]
    },

    // --- RASPBERRY ---
    "Raspberry___healthy": {
        plant: "Raspberry",
        displayName: "Healthy Raspberry",
        scientificName: "Rubus idaeus",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Vigorous canes", "Dark green serrated leaves"],
        treatment: ["Remove spent floricanes after harvest", "Trellising"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Thin canes for airflow"]
    },

    // --- SOYBEAN ---
    "Soybean___healthy": {
        plant: "Soybean",
        displayName: "Healthy Soybean",
        scientificName: "Glycine max",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Even green canopy", "No leaf skeletonization"],
        treatment: ["Maintain P and K levels", "Pest monitoring"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Proper seed depth"]
    },

    // --- SQUASH ---
    "Squash___Powdery_mildew": {
        plant: "Squash",
        displayName: "Squash Powdery Mildew",
        scientificName: "Podosphaera xanthii",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["White flour-like dust on leaves and stems", "Leaves eventually turn brown and crisp", "Reduced fruit quality"],
        treatment: ["Apply Neem oil or Milk spray (1 part milk : 9 parts water)", "Remove heavily infected leaves"],
        spray: { name: "Neem Oil or Sulfur", quantity: "5ml per Litre (Neem)", timing: "Evening, to avoid leaf burn", interval: "7 days", safety: "Avoid spraying if temps > 32°C" },
        prevention: ["Space plants properly", "Water at root zone only"]
    },

    // --- STRAWBERRY ---
    "Strawberry___Leaf_scorch": {
        plant: "Strawberry",
        displayName: "Strawberry Leaf Scorch",
        scientificName: "Diplocarpon earlianum",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["Irrregular purple/red blotches", "Tissue between spots turns brown", "Dried leaf margins (looks scorched)"],
        treatment: ["Remove older infected leaves", "Mow berry bed after harvest"],
        spray: { name: "Captan or Thiophanate-methyl", quantity: "2g per Litre", timing: "Spring bloom and after renovation", interval: "14 days", safety: "Do not exceed dosage" },
        prevention: ["Renovate strawberry beds annually", "Use well-drained soil"]
    },
    "Strawberry___healthy": {
        plant: "Strawberry",
        displayName: "Healthy Strawberry",
        scientificName: "Fragaria × ananassa",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Compact green growth", "No red spots on leaves"],
        treatment: ["Adequate mulching", "Removing runners regularly"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Sanitary picking"]
    },

    // --- TOMATO ---
    "Tomato___Bacterial_spot": {
        plant: "Tomato",
        displayName: "Tomato Bacterial Spot",
        scientificName: "Xanthomonas perforans",
        causedBy: "Bacteria",
        severity: "Major",
        symptoms: ["Small, water-soaked, greasy-looking spots", "Crusty warty spots on green fruit", "Fruit with black specks"],
        treatment: ["Remove infected lower leaves", "Spray copper bactericide"],
        spray: { name: "Copper + Mancozeb mix", quantity: "2g each per Litre", timing: "Late afternoon during warm/wet weather", interval: "7-10 days", safety: "Apply when wind is low to avoid drift" },
        prevention: ["Seed treatment with dilute bleach", "3-year crop rotation"]
    },
    "Tomato___Early_blight": {
        plant: "Tomato",
        displayName: "Tomato Early Blight",
        scientificName: "Alternaria solani",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["Brown spots with concentric rings", "Spots always appear on oldest leaves first", "Stem lesions (collar rot)"],
        treatment: ["Mulch the soil to prevent soil splash", "Pinch off bottom 3 leaves for airflow", "Remove all yellowing leaves"],
        spray: { name: "Chlorothalonil or Mancozeb", quantity: "2g per Litre", timing: "At first sign of lower leaf spots", interval: "7-10 days", safety: "Wait 7 days before eating after spray" },
        prevention: ["Practice crop rotation", "Stake or cage plants to keep leaves off the ground"]
    },
    "Tomato___Late_blight": {
        plant: "Tomato",
        displayName: "Tomato Late Blight",
        scientificName: "Phytophthora infestans",
        causedBy: "Fungus-like Pathogen",
        severity: "Critical",
        symptoms: ["Large, irregular, greenish-black water-soaked patches", "White fungal growth under leaves", "Greasy, brown rot on fruit"],
        treatment: ["Remove and destroy entire plant immediately", "Bag the plant then move it to avoid spreading spores"],
        spray: { name: "Copper Fungicide or Revus", quantity: "4ml per Litre", timing: "Preventive when blight is reported in area", interval: "5 days", safety: "Avoid inhalation; wash hands after use" },
        prevention: ["Buy certified disease-free seeds", "Check weather patterns (high humidity/cool nights)"]
    },
    "Tomato___Leaf_Mold": {
        plant: "Tomato",
        displayName: "Tomato Leaf Mold",
        scientificName: "Passalora fulva",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["Pale green/yellow spots on top of leaves", "Olive-green velvet-like mold underneath", "Lower leaves drop early"],
        treatment: ["Increase greenhouse ventilation", "Lower humidity (<85%)", "Apply fungicides to the underside of leaves"],
        spray: { name: "Copper or Chlorothalonil", quantity: "2g per Litre", timing: "As soon as mold is visible", interval: "7 days", safety: "Ensure full coverage of leaf underside" },
        prevention: ["Avoid overhead watering", "Wider plant spacing"]
    },
    "Tomato___Septoria_leaf_spot": {
        plant: "Tomato",
        displayName: "Septoria Leaf Spot",
        scientificName: "Septoria lycopersici",
        causedBy: "Fungus",
        severity: "Moderate",
        symptoms: ["Small circular spots (1/16 inch) with gray centers", "Tiny black specks in centers", "Usually moves from bottom to top"],
        treatment: ["Eliminate horsenettle and nightshade weeds", "Mulch base carefully"],
        spray: { name: "Chlorothalonil or Mancozeb", quantity: "2g per Litre", timing: "Start when symptoms first appear", interval: "7 days", safety: "Wear gloves when handling fungicide" },
        prevention: ["Remove all plant debris in fall", "2-year rotation"]
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        plant: "Tomato",
        displayName: "Two-Spotted Spider Mite",
        scientificName: "Tetranychus urticae",
        causedBy: "Mites (Arachnid)",
        severity: "Major",
        symptoms: ["Fine white stippling (dots) on leaf tops", "Fine webbing on leaf undersides", "Leaves turn yellow-bronze and drop"],
        treatment: ["Spray undersides of leaves with strong water jet", "Increase humidity", "Release predatory mites (biological control)"],
        spray: { name: "Abamectin or Insecticidal Soap", quantity: "2ml per Litre (Soap)", timing: "Early morning", interval: "5 days, 3 times", safety: "Ensure thorough coverage of leaf undersides" },
        prevention: ["Keep plants well-watered (stressed plants attract mites)", "Monitor frequently in hot, dry weather"]
    },
    "Tomato___Target_Spot": {
        plant: "Tomato",
        displayName: "Tomato Target Spot",
        scientificName: "Corynespora cassiicola",
        causedBy: "Fungus",
        severity: "Major",
        symptoms: ["Zonate (target-like) lesions", "Leaves look burned or blighted", "Sunken pits on fruit"],
        treatment: ["Improve drainage", "Remove infected material"],
        spray: { name: "Azoxystrobin", quantity: "1ml per Litre", timing: "Early sign of lesions", interval: "10 days", safety: "Check for chemical resistance patterns" },
        prevention: ["Proper row orientation for air flow"]
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        plant: "Tomato",
        displayName: "Yellow Leaf Curl Virus (TYLCV)",
        scientificName: "Tomato yellow leaf curl virus",
        causedBy: "Virus (Spread by Whiteflies)",
        severity: "Critical",
        symptoms: ["Severe upward leaf curling", "Stunted vertical growth (erect branches)", "Yellow leaf margins", "Flowers dropping early"],
        treatment: ["Remove and destroy infected plants", "Control Whiteflies using yellow sticky traps", "NO CURE for virus once infected"],
        spray: { name: "Imidacloprid (for Whitefly control)", quantity: "0.5ml per Litre", timing: "Apply only if Whiteflies are present", interval: "14 days", safety: "Wait 14 days before harvest" },
        prevention: ["Use silver or reflective mulch", "Install insect mesh screens"]
    },
    "Tomato___Tomato_mosaic_virus": {
        plant: "Tomato",
        displayName: "Tomato Mosaic Virus (ToMV)",
        scientificName: "Tomato mosaic virus",
        causedBy: "Virus",
        severity: "Major",
        symptoms: ["Mottled light/dark green leaf pattern", "Narrowed leaf blades (string-like)", "Uneven fruit ripening"],
        treatment: ["Wash hands with milk/soap before handling plants", "Destroy infected plants", "Tools must be disinfected with bleach"],
        spray: { name: "No chemical cure for viruses", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "Highly contagious through touch" },
        prevention: ["Smokers should wash hands (Tobacco carries viruses)", "Buy resistant varieties"]
    },
    "Tomato___healthy": {
        plant: "Tomato",
        displayName: "Healthy Tomato",
        scientificName: "Solanum lycopersicum",
        causedBy: "None",
        severity: "Healthy",
        symptoms: ["Lush green canopy", "Strong flower set", "Firm fruit"],
        treatment: ["Steady watering", "Suckering pruning"],
        spray: { name: "N/A", quantity: "N/A", timing: "N/A", interval: "N/A", safety: "N/A" },
        prevention: ["Consistent mulching"]
    }
};

/**
 * Get internal disease data for a predicted label
 */
function getDiseaseInfo(label) {
    return CROP_DATABASE[label] || null;
}

/**
 * Get all valid class labels for training
 */
function getModelLabels() {
    return Object.keys(CROP_DATABASE).sort();
}

/**
 * Search database by keyword (disease, plant, symptom, etc)
 */
function searchByKeyword(keyword) {
    const k = keyword.toLowerCase();
    const results = [];

    for (const [key, data] of Object.entries(CROP_DATABASE)) {
        if (
            data.displayName.toLowerCase().includes(k) ||
            data.plant.toLowerCase().includes(k) ||
            data.causedBy.toLowerCase().includes(k) ||
            data.symptoms.some(s => s.toLowerCase().includes(k)) ||
            data.treatment.some(t => t.toLowerCase().includes(k))
        ) {
            results.push({ ...data, diseaseKey: key });
        }
    }
    return results;
}

/**
 * Algorithmic safety check (No AI)
 * Rules: 
 * - Temperature: 10-30°C (Safe)
 * - Wind: < 15 km/h (Safe)
 * - Humidity: 40-70% (Optimal)
 */
function getSpraySafetyCheck(temp, humidity, windKmH) {
    const warnings = [];
    let safe = true;

    if (temp > 30) {
        warnings.push("🌡️ High Temperature: Pesticides may evaporate too quickly or cause plant burns.");
        safe = false;
    }
    if (temp < 10) {
        warnings.push("❄️ Low Temperature: Chemical absorption is reduced.");
    }
    if (windKmH > 15) {
        warnings.push("💨 High Wind: Spray drift risk is high. Do NOT spray.");
        safe = false;
    }
    if (humidity > 85) {
        warnings.push("💧 High Humidity: Longer drying time increases fungal risk.");
    }
    
    if (safe && warnings.length === 0) {
        warnings.push("✅ Weather conditions look safe for spraying.");
    } else if (safe) {
        warnings.push("⚠️ Spray with caution — some environmental factors are not ideal.");
    }

    return { safe, warnings };
}

module.exports = { 
    CROP_DATABASE, 
    getDiseaseInfo, 
    getModelLabels, 
    searchByKeyword, 
    getSpraySafetyCheck 
};
