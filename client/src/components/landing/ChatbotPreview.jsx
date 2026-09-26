import React, { useState } from "react";
import { MessageIcon, BotIcon, UserIcon, SparklesIcon, ShieldIcon } from "../Icons";

export default function ChatbotPreview() {
  const [activeChip, setActiveChip] = useState(0);

  const dialogThreads = [
    {
      chip: "पानांवर डाग पडण्याचे कारण? (Symptoms)",
      messages: [
        {
          role: "farmer",
          text: "या पानांवर डाग का आले आहेत? (What is causing these spots on my leaves?)"
        },
        {
          role: "ai",
          text: "पानावरील दिसणारी लक्षणे आणि गोल तपकिरी डाग 'अर्ली ब्लाइट' (Early Blight) या बुरशीजन्य रोगाशी सुसंगत आहेत. सध्याच्या ७८% आर्द्रता आणि २७°C तापमानामुळे बुरशीची वाढ होण्यासाठी अनुकूल परिस्थिती तयार झाली आहे. रोगाचा प्रादुर्भाव रोखण्यासाठी पाने कोरडी ठेवणे महत्त्वाचे आहे.",
          source: "ICAR-IIVR Tomato Pathology Handbook & Context Engine"
        }
      ]
    },
    {
      chip: "आता मी काय काळजी घ्यावी? (Immediate Steps)",
      messages: [
        {
          role: "farmer",
          text: "आता मी काय काळजी घ्यावी? (What immediate precautions should I take?)"
        },
        {
          role: "ai",
          text: "१. खालील बाधित पाने खुडून शेताबाहेर नेऊन नष्ट करा.\n२. तुषार सिंचन पूर्णपणे बंद करा, केवळ ठिबक सिंचन द्या.\n३. कॉपर ऑक्सिक्लोराईड (५०% WP @ २.५ ग्रॅम प्रति लिटर पाणी) प्रमाणे सकाळच्या वेळेत फवारा.\n४. ५ दिवसांनी पुन्हा नवीन पानांचे छायाचित्र ॲपवर अपलोड करून प्रगती तपासा.",
          source: "MPKV Rahuri Standard Spray Schedule (2026)"
        }
      ]
    },
    {
      chip: "फवारणीनंतर पाऊस आला तर? (Rain Window)",
      messages: [
        {
          role: "farmer",
          text: "फवारणीनंतर २ तासांत पाऊस आला तर काय करावे? (What if it rains after spray?)"
        },
        {
          role: "ai",
          text: "संपर्क बुरशीनाशक (उदा. Mancozeb) पावसामुळे वाहून जाण्याची शक्यता असते. जर पाऊस हलका असेल आणि फवारणीत 'स्टिकर/स्प्रेडर' मिसळले असेल तर परिणाम टिकून राहतो. मुसळधार पाऊस झाल्यास २४ तासांनंतर पाऊस उघडल्यावर अर्ध्या प्रमाणात पुनर्रफवारणी करावी.",
          source: "CIB&RC Agronomic Rain-Fastness Rules"
        }
      ]
    }
  ];

  const currentThread = dialogThreads[activeChip] || dialogThreads[0];

  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="section-head">
          <div className="section-eyebrow">
            <MessageIcon size={14} color="var(--agri-primary)" />
            <span>Context-Grounded Conversational AI</span>
          </div>
          <h2 className="section-title">Your Crop Health Assistant.</h2>
          <p className="section-desc">
            Unlike generic chatbots, the Agri-AI assistant is strictly grounded in your specific crop diagnosis, local weather telemetry, and verified ICAR/MPKV agricultural university guidelines.
          </p>
        </div>

        {/* Chat Mockup Wrapper */}
        <div className="chat-mockup-wrapper">
          {/* Header */}
          <div className="chat-mockup-header">
            <div className="chat-header-user">
              <div className="chat-avatar">
                <BotIcon size={18} color="#042f15" />
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem" }}>
                  Agri-AI Agronomic Assistant
                </strong>
                <span style={{ fontSize: "0.75rem", opacity: 0.85, display: "flex", alignItems: "center", gap: "4px" }}>
                  <ShieldIcon size={11} color="#34d399" />
                  <span>Context: Tomato · Early Blight · Sangli (Rain 4.2mm)</span>
                </span>
              </div>
            </div>
            <span style={{ fontSize: "0.72rem", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "0.2rem 0.55rem", borderRadius: "4px", fontWeight: 700 }}>
              Grounded Mode
            </span>
          </div>

          {/* Interactive Chips Bar */}
          <div className="chat-chips-bar">
            {dialogThreads.map((thread, idx) => (
              <button
                key={thread.chip}
                type="button"
                className="chat-chip-btn"
                style={{
                  background: activeChip === idx ? "var(--agri-primary)" : "#ffffff",
                  color: activeChip === idx ? "#ffffff" : "var(--agri-primary)",
                  borderColor: "var(--agri-primary)"
                }}
                onClick={() => setActiveChip(idx)}
              >
                {thread.chip}
              </button>
            ))}
          </div>

          {/* Chat Feed */}
          <div className="chat-feed">
            {currentThread.messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`}>
                <div style={{ whiteSpace: "pre-line" }}>{m.text}</div>
                {m.source && (
                  <div className="chat-bubble-source">
                    <SparklesIcon size={12} color="var(--agri-primary)" />
                    <span>Knowledge Source: {m.source}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
