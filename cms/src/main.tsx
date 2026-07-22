import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./styles/cms.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("CMS root element not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
