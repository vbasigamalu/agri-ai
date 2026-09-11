/**
 * pestDatabase.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Agricultural Knowledge Base & Advisory for Pests
 * Covers all 9 classes from the trained dataset:
 * aphids, armyworm, beetle, bollworm, grasshopper, mites, mosquito, sawfly, stem_borer
 * 
 * Includes:
 * - Scientific name & common vernacular names
 * - Common host crops
 * - Key visual symptoms & damage patterns
 * - Economic Threshold Level (ETL) guidelines for trap counts & plant scouting
 * - Organic / Biological IPM controls
 * - Recommended Chemical controls (CIB&RC approved)
 * - Cultural & Preventive measures
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PEST_DATABASE = {
    aphids: {
        id: "aphids",
        name: "Aphids",
        scientificName: "Aphis gossypii / Myzus persicae",
        vernacular: "Mahlo / Cheepa / Poka (माहो / चेंपा)",
        crops: ["Cotton", "Mustard", "Chilli", "Tomato", "Wheat", "Okra", "Potato"],
        description: "Small, soft-bodied pear-shaped sap-sucking insects clustering on tender shoots, buds, and under leaves.",
        etl: {
            threshold: 20,
            unit: "pests/leaf (or >50 in yellow sticky trap)",
            guidance: "20 aphids per tender leaf or sticky trap density > 50 insects/trap/week"
        },
        symptoms: [
            "Curling and crinkling of tender young leaves",
            "Sticky honeydew secretion leading to black sooty mold fungus",
            "Stunted vegetative growth and yellowing foliage",
            "Transmission of viral diseases (e.g. Cotton Leaf Curl, CMV)"
        ],
        biologicalControl: [
            "Install Yellow Sticky Traps @ 10–12 traps/acre",
            "Conserve natural predators: Ladybird beetles (Coccinella septempunctata) and Chrysoperla carnea",
            "Foliar spray of 5% Neem Seed Kernel Extract (NSKE) or Neem Oil 1500 ppm @ 5 ml/L",
            "Spray entomopathogenic fungus Beauveria bassiana or Verticillium lecanii @ 5 g/L"
        ],
        chemicalControl: [
            "Imidacloprid 17.8% SL @ 0.5 ml/L of water",
            "Acetamiprid 20% SP @ 0.2 g/L of water",
            "Thiamethoxam 25% WG @ 0.2 g/L of water",
            "Dimethoate 30% EC @ 1.5 ml/L (if infestation is severe)"
        ],
        prevention: [
            "Avoid excessive use of high-nitrogen synthetic fertilizers",
            "Maintain reflective silver or yellow plastic mulching",
            "Eradicate broadleaf weed hosts along field boundaries"
        ]
    },

    armyworm: {
        id: "armyworm",
        name: "Fall Armyworm",
        scientificName: "Spodoptera frugiperda / Spodoptera litura",
        vernacular: "Lashkari Sundi / Sainik Kida (सैनिक कीड़ा)",
        crops: ["Maize", "Sorghum", "Paddy", "Sugarcane", "Cotton", "Millets"],
        description: "Voracious foliar-feeding caterpillar characterized by an inverted 'Y' on its head capsule and 4 square-arranged spots on the 8th abdominal segment.",
        etl: {
            threshold: 8,
            unit: "moths/trap/night (or >10% damaged plants)",
            guidance: "8–10 adult moths/pheromone trap/night or 5–10% fresh whorl damage in maize"
        },
        symptoms: [
            "Shot-hole and windowing damage on leaf blades",
            "Heavy whorl defoliation with copious brown sawdust-like frass (excreta)",
            "Destruction of growing central shoot (dead heart in seedlings)"
        ],
        biologicalControl: [
            "Install FAW Pheromone traps @ 5 traps/acre for surveillance, 15/acre for mass trapping",
            "Release egg parasitoid Trichogramma pretiosum @ 50,000/acre at 7-day intervals",
            "Apply Nomuraea rileyi or Metarhizium anisopliae @ 5 g/L",
            "Poison bait application: 10 kg rice bran + 1 kg jaggery fermented with 100 g Thiodicarb or Chlorpyrifos"
        ],
        chemicalControl: [
            "Chlorantraniliprole 18.5% SC (Coragen) @ 0.4 ml/L of water into whorls",
            "Emamectin Benzoate 5% SG (Proclaim) @ 0.4 g/L of water",
            "Spinetoram 11.7% SC @ 0.5 ml/L of water",
            "Flubendiamide 39.35% SC @ 0.3 ml/L of water"
        ],
        prevention: [
            "Deep summer ploughing to expose pupae to predatory birds and solar heat",
            "Intercrop maize with pulses (cowpea, pigeonpea, or blackgram)",
            "Timely synchronized sowing across the village cluster"
        ]
    },

    beetle: {
        id: "beetle",
        name: "Flea / Blister Beetle",
        scientificName: "Podagrica spp. / Mylabris pustulata",
        vernacular: "Chunri Kida / Phudki Beetle (भृंग / फ्ली बीटल)",
        crops: ["Brinjal", "Tomato", "Okra", "Cotton", "Crucifers", "Pulses"],
        description: "Hard-shelled jumping or crawling coleopteran beetles that feed on floral parts, flower buds, and leaf epidermis.",
        etl: {
            threshold: 5,
            unit: "beetles/plant (or >10% defoliation)",
            guidance: "5 beetles per plant or >10% foliage/flower destruction"
        },
        symptoms: [
            "Small round 'shot-holes' peppered across leaf surfaces",
            "Chewed petals, stamens, and dropped flower buds",
            "Skeletonized leaf veins with dry brown patches"
        ],
        biologicalControl: [
            "Hand-picking with kerosene-water trays during early morning hours",
            "Spray Neem oil (Azadirachtin 10,000 ppm) @ 2 ml/L",
            "Dusting with wood ash or diatomaceous earth on moist leaves"
        ],
        chemicalControl: [
            "Malathion 50% EC @ 2 ml/L of water",
            "Cypermethrin 10% EC @ 1 ml/L of water",
            "Spinosad 45% SC @ 0.3 ml/L of water"
        ],
        prevention: [
            "Frequent light soil tilling to destroy subterranean pupae",
            "Cover young nursery beds with 40-mesh insect netting"
        ]
    },

    bollworm: {
        id: "bollworm",
        name: "Cotton Bollworm / Fruit Borer",
        scientificName: "Helicoverpa armigera / Pectinophora gossypiella",
        vernacular: "Gulaabi Sundi / Chane ki Sundi (गुलाबी सुंडी)",
        crops: ["Cotton", "Tomato", "Gram (Chickpea)", "Chilli", "Pigeonpea", "Okra"],
        description: "Destructive caterpillar boring into squares, flowers, bolls, and fruiting bodies with body partially protruding outside.",
        etl: {
            threshold: 8,
            unit: "moths/pheromone trap/night for 3 consecutive days",
            guidance: "8 moths/trap/night or 1 larva/meter row length or 5% rosette flowers"
        },
        symptoms: [
            "Rosette flowers (petals tied together with silk web)",
            "Bored holes on cotton bolls or tomato fruits plugged with feces",
            "Premature shedding of fruiting squares, flowers, and young bolls",
            "Internal staining and rotting of cotton lint"
        ],
        biologicalControl: [
            "Install Gossyplure / Helilure pheromone traps @ 5/acre for monitoring, 10–12/acre for mating disruption",
            "Release egg parasitoid Trichogramma chilonis @ 60,000/acre at weekly intervals",
            "Spray HaNPV (Helicoverpa armigera Nuclear Polyhedrosis Virus) @ 250 LE/acre in evening hours",
            "Apply Neem Oil 1500 ppm @ 5 ml/L at initiation of squaring"
        ],
        chemicalControl: [
            "Emamectin Benzoate 5% SG @ 0.4 g/L of water",
            "Chlorantraniliprole 18.5% SC @ 0.3 ml/L of water",
            "Flubendiamide 20% WG @ 0.5 g/L of water",
            "Indoxacarb 14.5% SC @ 1 ml/L of water"
        ],
        prevention: [
            "Plant castor, marigold, or okra as trap crops around cotton borders",
            "Strict termination of cotton ratoon crop by January-February to break diapause",
            "Deep summer tillage to destroy hibernating pupae in soil"
        ]
    },

    grasshopper: {
        id: "grasshopper",
        name: "Grasshopper / Locust",
        scientificName: "Hieroglyphus nigrorepletus / Oxya nitidula",
        vernacular: "Tiddi / Tiddi Dal (टिड्डी / फदका)",
        crops: ["Paddy", "Maize", "Sugarcane", "Wheat", "Millets", "Grasslands"],
        description: "Active jumping and flying orthopteran insects with strong chewing mouthparts that chew leaves from outer margins inwards.",
        etl: {
            threshold: 5,
            unit: "nymphs or adults/sweep net or m²",
            guidance: "1–2 grasshoppers/hill in rice or >5 grasshoppers/m² on field bunds"
        },
        symptoms: [
            "Irregular, jagged notches chewed along leaf margins",
            "Severe stripping of green foliage leaving only midribs",
            "Cut panicles and severed tillers during heading stage"
        ],
        biologicalControl: [
            "Digging and scraping field bunds during summer to destroy egg pods",
            "Use bird perches @ 15–20/acre to attract egrets and mynas",
            "Biopesticide application: Metarhizium acridum @ 2.5 g/L of water"
        ],
        chemicalControl: [
            "Chlorpyrifos 20% EC @ 2.5 ml/L of water (dusting field bunds)",
            "Malathion 5% dust @ 10 kg/acre on peripheral bunds",
            "Fipronil 5% SC @ 2 ml/L of water"
        ],
        prevention: [
            "Keep peripheral bunds clear of wild grasses and weeds",
            "Scrape soil to 5 cm depth on bunds after harvest to expose egg packets"
        ]
    },

    mites: {
        id: "mites",
        name: "Two-Spotted Spider Mites",
        scientificName: "Tetranychus urticae / Polyphagotarsonemus latus",
        vernacular: "Laal Makdi / Jur (लाल मकड़ी)",
        crops: ["Chilli", "Cotton", "Brinjal", "Tomato", "Tea", "Rose", "Cucurbits"],
        description: "Microscopic eight-legged arachnids dwelling underneath leaves in dense fine silken webbing, proliferating in hot, dry weather.",
        etl: {
            threshold: 10,
            unit: "mites/cm² leaf area",
            guidance: ">10 active mites/cm² or webbing visible across >15% of lower leaves"
        },
        symptoms: [
            "Fine pale yellow stippling and bronzing on upper leaf surface",
            "Downward curling (inverted boat shape) in chilli (Murda disease complex)",
            "Silken cobwebs covering leaf undersides, flower clusters, and shoots",
            "Severe defoliation and scorched, papery appearance of canopy"
        ],
        biologicalControl: [
            "Foliar water misting or sprinkler irrigation to elevate humidity (mites hate wet foliage)",
            "Release predatory mites (Phytoseiulus persimilis or Amblyseius swirskii)",
            "Foliar spray of Wettable Sulphur 80% WP @ 3 g/L of water",
            "Neem-based Pongamia pinnata (Karanja) oil @ 3 ml/L"
        ],
        chemicalControl: [
            "Spiromesifen 22.9% SC @ 1 ml/L of water",
            "Fenazaquin 10% EC @ 2 ml/L of water",
            "Propargite 57% EC @ 2 ml/L of water",
            "Diafenthiuron 50% WP @ 1.2 g/L of water"
        ],
        prevention: [
            "Avoid synthetic pyrethroid sprays which kill natural predatory mites and cause resurgence",
            "Keep irrigation optimal during hot dry months (March–June)"
        ]
    },

    mosquito: {
        id: "mosquito",
        name: "Tea Mosquito Bug",
        scientificName: "Helopeltis antonii",
        vernacular: "Chai Machhar / Mirid Bug (चाय मच्छर बग)",
        crops: ["Cashew", "Tea", "Guava", "Cocoa", "Cotton", "Drumstick"],
        description: "Slender reddish-brown mirid bug with a characteristic pin-like dorsal spine on the scutellum, injecting toxic saliva into young shoots.",
        etl: {
            threshold: 5,
            unit: "bugs/tree or 5% affected shoot flushes",
            guidance: ">5% freshly damaged flushes or 2–3 active bugs per sampled tree"
        },
        symptoms: [
            "Necrotic, water-soaked brownish-black lesions on tender flush shoots",
            "Dieback and complete drying up of young twigs ('die-back' condition)",
            "Scabby, corky crater-like pustules on developing cashew nuts and guava fruit"
        ],
        biologicalControl: [
            "Conserve predatory weaver ants (Oecophylla smaragdina)",
            "Foliar spray of 5% NSKE (Neem Seed Kernel Extract) during flush emergence",
            "Spray Beauveria bassiana @ 5 g/L"
        ],
        chemicalControl: [
            "Lambda-cyhalothrin 5% EC @ 0.6 ml/L of water",
            "Thiamethoxam 25% WG @ 0.25 g/L of water",
            "Clothianidin 50% WDG @ 0.2 g/L of water"
        ],
        prevention: [
            "Prune congested criss-cross branches to ensure sunlight penetration",
            "Synchronize chemical sprays during flushing, flowering, and fruit-set periods"
        ]
    },

    sawfly: {
        id: "sawfly",
        name: "Mustard Sawfly",
        scientificName: "Athalia lugens proxima",
        vernacular: "Sarson ki Makhi / Kaali Sundi (सरसों की मक्खी)",
        crops: ["Mustard", "Rapeseed", "Radish", "Cabbage", "Cauliflower", "Turnip"],
        description: "Dark greenish-black cylindrical larvae with wrinkled skin that feed voraciously on seedling brassica crops, dropping to ground when disturbed.",
        etl: {
            threshold: 2,
            unit: "larvae/meter row length",
            guidance: "2 larvae per meter row length in early seedling stage (up to 30 days after sowing)"
        },
        symptoms: [
            "Circular or elliptical holes chewed out of cotyledons and leaves",
            "Complete defoliation leaving only major leaf veins in seedling stage",
            "Seedling death requiring gap filling or re-sowing"
        ],
        biologicalControl: [
            "Hand collection and destruction of sluggish larvae during cold morning hours",
            "Spray Neem Seed Kernel Extract (NSKE) 5% @ 50 ml/L or Neem Oil @ 5 ml/L",
            "Conservation of hymenopteran parasitoids"
        ],
        chemicalControl: [
            "Malathion 50% EC @ 1.5 ml/L of water",
            "Quinalphos 25% EC @ 1.5 ml/L of water",
            "Chlorpyrifos 20% EC @ 2 ml/L of water"
        ],
        prevention: [
            "Early morning irrigation causes larvae to fall into soil and drown",
            "Summer ploughing to destroy overwintering pupae in soil"
        ]
    },

    stem_borer: {
        id: "stem_borer",
        name: "Paddy / Maize Stem Borer",
        scientificName: "Scirpophaga incertulas / Chilo partellus",
        vernacular: "Tana Chhedak / Tana Sundi (तना छेदक)",
        crops: ["Paddy (Rice)", "Maize", "Sugarcane", "Sorghum", "Wheat"],
        description: "Internal tunneling caterpillar boring into the central vascular stalk of cereal crops, causing dead heart in vegetative phase and white earhead in reproductive phase.",
        etl: {
            threshold: 5,
            unit: "moths/trap/night (or 1 egg mass/m²)",
            guidance: "1 egg mass/m² or 5% dead hearts at vegetative stage, 1 moth/m² or 2% white ears at flowering"
        },
        symptoms: [
            "Dead Heart: Central shoot wilts, turns brown, and pulls out easily when tugged",
            "White Earhead: Empty, chaffy, completely white panicles with no grain filling",
            "Frass and circular entry/exit pinholes at the base of the lower culm"
        ],
        biologicalControl: [
            "Install Scirpophaga pheromone traps @ 5/acre for monitoring, 12/acre for mass trapping",
            "Release egg parasitoid Trichogramma japonicum @ 40,000/acre weekly from 30 DAP",
            "Clipping of seedling leaf tips before transplanting to remove egg masses",
            "Erect bird perches @ 20/acre across paddy fields"
        ],
        chemicalControl: [
            "Cartap Hydrochloride 4% G (granules) @ 7.5 kg/acre into 2–3 cm standing water",
            "Fipronil 0.3% G @ 8–10 kg/acre or Chlorantraniliprole 0.4% G @ 4 kg/acre",
            "Chlorantraniliprole 18.5% SC (Coragen) foliar spray @ 0.3 ml/L",
            "Flubendiamide 39.35% SC @ 0.25 ml/L of water"
        ],
        prevention: [
            "Avoid excessive nitrogen fertilization which produces lush succulent tillers prone to borer attack",
            "Harvest rice plants at ground level and plough stubble immediately to kill overwintering larvae",
            "Synchronize transplanting across contiguous fields"
        ]
    }
};

/**
 * Calculates severity level based on detected pest and farmer's trap count / infestation report.
 * @param {string} pestId - e.g. "armyworm", "aphids"
 * @param {number} trapCount - number entered by farmer
 * @returns {object} { severity, isEtlExceeded, statusColor, advice }
 */
function evaluateInfestation(pestId, trapCount = 0) {
    const pest = PEST_DATABASE[pestId.toLowerCase()] || PEST_DATABASE.aphids;
    const threshold = pest.etl.threshold;

    let severity = "Low";
    let isEtlExceeded = false;
    let statusColor = "#10b981"; // Green
    let summaryText = `Trap count (${trapCount}) is below the Economic Threshold Level (${threshold} ${pest.etl.unit}). Safe to monitor.`;

    if (trapCount >= threshold * 1.5) {
        severity = "Critical (Severe Infestation)";
        isEtlExceeded = true;
        statusColor = "#ef4444"; // Red
        summaryText = `🚨 URGENT: Trap count (${trapCount}) significantly EXCEEDS the Economic Threshold Level (${threshold} ${pest.etl.unit}). Immediate chemical/IPM intervention required to prevent severe crop loss!`;
    } else if (trapCount >= threshold) {
        severity = "Moderate (ETL Threshold Reached)";
        isEtlExceeded = true;
        statusColor = "#f59e0b"; // Orange/Amber
        summaryText = `⚠️ ALERT: Trap count (${trapCount}) has reached the Economic Threshold Level (${threshold} ${pest.etl.unit}). Initiate recommended biological controls or targeted sprays.`;
    } else if (trapCount >= threshold * 0.5) {
        severity = "Mild (Active Population)";
        isEtlExceeded = false;
        statusColor = "#3b82f6"; // Blue
        summaryText = `ℹ️ Notice: Trap count (${trapCount}) is approaching the threshold. Inspect field every 2–3 days and deploy sticky/pheromone traps.`;
    }

    return {
        severity,
        isEtlExceeded,
        statusColor,
        summaryText,
        pest,
        threshold
    };
}

/**
 * Forecasts future pest population and outbreak risk based on historical earlier days data
 * @param {string} pestId - e.g. "armyworm", "aphids"
 * @param {number} currentCount - Today's count
 * @param {Array<{ daysAgo: number, count: number }>} historyPoints - Earlier days records
 * @returns {object} Forecasting analysis with trajectory, projected counts, and alert
 */
function forecastPestTrajectory(pestId, currentCount = 0, historyPoints = []) {
    const pest = PEST_DATABASE[pestId.toLowerCase()] || PEST_DATABASE.aphids;
    const threshold = pest.etl.threshold;

    // Filter valid history points (must have daysAgo > 0 and numeric count)
    const validHistory = (historyPoints || [])
        .filter(p => p && typeof p.count === "number" && !isNaN(p.count) && p.daysAgo > 0)
        .sort((a, b) => b.daysAgo - a.daysAgo); // oldest first

    let trend = "Baseline Single Observation";
    let growthRatePercent = 0;
    let dailyVelocity = 0;
    let projectedIn3Days = currentCount;
    let projectedIn7Days = currentCount;
    let riskLevel = "Normal";
    let riskColor = "#10b981";
    let alertHeadline = "Routine Field Monitoring";
    let actionRecommendation = "Maintain regular trap checks every 3–4 days.";
    let sprayWindow = "No immediate chemical spray needed";

    if (validHistory.length > 0) {
        // Calculate change from earliest recorded point
        const earliest = validHistory[0]; // e.g. 7 days ago
        const deltaDays = Math.max(1, earliest.daysAgo);
        const deltaCount = currentCount - earliest.count;

        dailyVelocity = parseFloat((deltaCount / deltaDays).toFixed(2));
        
        if (earliest.count > 0) {
            growthRatePercent = Math.round((deltaCount / earliest.count) * 100);
        } else {
            growthRatePercent = currentCount > 0 ? 100 : 0;
        }

        // Projection using rate of change
        if (deltaCount > 0) {
            const growthFactor = Math.pow(Math.max(1, currentCount) / Math.max(1, earliest.count), 1 / deltaDays);
            const safeFactor = Math.min(1.4, Math.max(1.02, growthFactor));
            projectedIn3Days = Math.round(currentCount * Math.pow(safeFactor, 3));
            projectedIn7Days = Math.round(currentCount * Math.pow(safeFactor, 7));
        } else {
            // Declining trend
            projectedIn3Days = Math.max(0, Math.round(currentCount + dailyVelocity * 3));
            projectedIn7Days = Math.max(0, Math.round(currentCount + dailyVelocity * 7));
        }

        // Risk Level Evaluation
        if (deltaCount > 0 && (projectedIn3Days >= threshold * 1.5 || currentCount >= threshold * 1.3 || growthRatePercent >= 75)) {
            trend = "Surging Rapidly (Outbreak Alert 🚨)";
            riskLevel = "CRITICAL OUTBREAK HAZARD";
            riskColor = "#ef4444";
            alertHeadline = "🚨 Severe Outbreak Surge Detected!";
            actionRecommendation = `Pest population jumped by +${growthRatePercent}% over ${deltaDays} days (+${dailyVelocity} pests/day). Projected to reach ${projectedIn3Days} within 3 days. Immediate targeted intervention needed to prevent irreversible crop loss.`;
            sprayWindow = "URGENT: Spray within 24 to 36 hours (before next generation emerges)";
        } else if (deltaCount > 0 && (projectedIn3Days >= threshold || currentCount >= threshold * 0.8)) {
            trend = "Increasing Towards ETL (High Alert ⚠️)";
            riskLevel = "HIGH RISK — ETL BREACH IMMINENT";
            riskColor = "#f59e0b";
            alertHeadline = "⚠️ Economic Threshold (ETL) Breach Projected";
            actionRecommendation = `Population has grown by +${growthRatePercent}%. At the current pace of +${dailyVelocity} pests/day, it will surpass the Economic Threshold (${threshold} ${pest.etl.unit}) within 48–72 hours.`;
            sprayWindow = "Apply recommended bio-control or selective spray within 48 to 72 hours";
        } else if (deltaCount > 0) {
            trend = "Slowly Increasing (Moderate Monitor 🟡)";
            riskLevel = "MODERATE RISK";
            riskColor = "#3b82f6";
            alertHeadline = "Active Population Buildup";
            actionRecommendation = `Pest count increased by +${deltaCount} (+${growthRatePercent}%) over ${deltaDays} days. Population remains below threshold. Increase scouting frequency.`;
            sprayWindow = "Deploy additional pheromone / sticky traps; hold chemical spray";
        } else if (deltaCount < 0) {
            trend = "Declining Population (Suppressed 🟢)";
            riskLevel = "CONTROLLED / LOW RISK";
            riskColor = "#10b981";
            alertHeadline = "Pest Population Decreasing";
            actionRecommendation = `Pest numbers dropped by ${Math.abs(growthRatePercent)}% over ${deltaDays} days (${earliest.count} ➔ ${currentCount}). Natural biocontrol predators or prior treatments are effectively suppressing the pest.`;
            sprayWindow = "Do NOT spray chemicals — preserve beneficial predatory insects";
        } else {
            trend = "Stable Population (No Change ⏸️)";
            riskLevel = "LOW RISK";
            riskColor = "#10b981";
            alertHeadline = "Population Stable";
            actionRecommendation = `Trap count is holding steady at ${currentCount} pests. Continue weekly monitoring.`;
            sprayWindow = "No spray required at present";
        }
    } else {
        // No historical points provided: baseline projection from current single count
        if (currentCount >= threshold * 1.5) {
            trend = "Above Critical Threshold";
            riskLevel = "CRITICAL (SINGLE COUNT)";
            riskColor = "#ef4444";
            projectedIn3Days = Math.round(currentCount * 1.25);
            projectedIn7Days = Math.round(currentCount * 1.6);
            actionRecommendation = `Single observation (${currentCount}) already breaches threshold (${threshold} ${pest.etl.unit}). Urgent spray advised.`;
            sprayWindow = "Apply control within 24–48 hours";
        } else if (currentCount >= threshold) {
            trend = "At Threshold Limit";
            riskLevel = "MODERATE TO HIGH";
            riskColor = "#f59e0b";
            projectedIn3Days = Math.round(currentCount * 1.15);
            projectedIn7Days = Math.round(currentCount * 1.35);
            actionRecommendation = `Trap count is at threshold (${threshold}). Prepare bio-pesticide or recommended spray.`;
            sprayWindow = "Apply within 48–72 hours if no reduction seen";
        } else {
            projectedIn3Days = Math.round(currentCount * 1.1);
            projectedIn7Days = Math.round(currentCount * 1.2);
        }
    }

    // Timeline for trend visualization: Past -> Today -> Future
    const timeline = [];
    validHistory.forEach(p => {
        timeline.push({
            label: `${p.daysAgo} Days Ago`,
            daysAgo: p.daysAgo,
            count: p.count,
            type: "historical"
        });
    });
    timeline.push({
        label: "Today",
        daysAgo: 0,
        count: currentCount,
        type: "actual"
    });
    timeline.push({
        label: "+3 Days",
        daysAgo: -3,
        count: projectedIn3Days,
        type: "forecast"
    });
    timeline.push({
        label: "+7 Days",
        daysAgo: -7,
        count: projectedIn7Days,
        type: "forecast"
    });

    return {
        trend,
        riskLevel,
        riskColor,
        growthRatePercent,
        dailyVelocity,
        projectedIn3Days,
        projectedIn7Days,
        alertHeadline,
        actionRecommendation,
        sprayWindow,
        threshold,
        timeline,
        hasHistory: validHistory.length > 0
    };
}

module.exports = {
    PEST_DATABASE,
    evaluateInfestation,
    forecastPestTrajectory
};
