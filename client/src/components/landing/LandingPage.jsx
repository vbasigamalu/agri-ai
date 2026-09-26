import React from "react";
import "./landing.css";

import Navbar from "./Navbar";
import Hero from "./Hero";
import ProblemSection from "./ProblemSection";
import SolutionFlow from "./SolutionFlow";
import FeatureGrid from "./FeatureGrid";
import VisionSection from "./VisionSection";
import ContextSection from "./ContextSection";
import HotspotMap from "./HotspotMap";
import AdvisoryCard from "./AdvisoryCard";
import ChatbotPreview from "./ChatbotPreview";
import MonitoringTimeline from "./MonitoringTimeline";
import ExpertValidation from "./ExpertValidation";
import TechStack from "./TechStack";
import Architecture from "./Architecture";
import Impact from "./Impact";
import CTA from "./CTA";
import Footer from "./Footer";

export default function LandingPage({
  user,
  onLogin,
  onGetStarted,
  onAnalyzeCrop,
  onGoToApp
}) {
  const handleAnalyze = () => {
    if (onAnalyzeCrop) {
      onAnalyzeCrop();
    } else if (onGoToApp) {
      onGoToApp("detect");
    }
  };

  const handleExplore = () => {
    if (onGoToApp) {
      onGoToApp("dashboard");
    } else if (onGetStarted) {
      onGetStarted();
    }
  };

  return (
    <div className="agri-landing-wrapper">
      {/* 1. Sticky Responsive Navbar */}
      <Navbar
        user={user}
        onLogin={onLogin}
        onGetStarted={onGetStarted || handleExplore}
        onGoToApp={onGoToApp}
      />

      {/* 2. Hero Section */}
      <Hero
        onAnalyzeCrop={handleAnalyze}
        onExploreHowItWorks={handleExplore}
        onLogin={onLogin}
      />

      {/* 3. Problem Section */}
      <ProblemSection />

      {/* 4. Solution Workflow Section */}
      <SolutionFlow />

      {/* 5. Core Features Grid */}
      <FeatureGrid />

      {/* 6. AI Computer Vision Section */}
      <VisionSection />

      {/* 7. Context Intelligence & Risk Engine */}
      <ContextSection />

      {/* 8. Geospatial Hotspot Surveillance */}
      <HotspotMap />

      {/* 9. Farmer Advisory Section with Multilingual Engine */}
      <AdvisoryCard />

      {/* 10. AI Chatbot Assistant Preview */}
      <ChatbotPreview onOpenChat={handleExplore} />

      {/* 11. Longitudinal Follow-up Timeline */}
      <MonitoringTimeline />

      {/* 12. Expert Validation & Active Learning */}
      <ExpertValidation />

      {/* 13. Technology Stack */}
      <TechStack />

      {/* 14. Complete System Flow Diagram */}
      <Architecture />

      {/* 15. Real Agricultural Impact */}
      <Impact />

      {/* 16. Final Action CTA */}
      <CTA
        onAnalyzeCrop={handleAnalyze}
        onExplorePlatform={handleExplore}
        onLogin={onLogin}
      />

      {/* 17. Brand & Technology Footer */}
      <Footer />
    </div>
  );
}
