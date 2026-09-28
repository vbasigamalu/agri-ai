import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { setupApiInterceptor } from "./services/apiInterceptor";

// Initialize network resilience & zero-error client API fallback for deployed domains
setupApiInterceptor();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
