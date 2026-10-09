import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { JomBitApp } from "../app/components/JomBitApp";
import { PhonePreview } from "./PhonePreview";
import { MarketingSite } from "./website/MarketingSite";
import "../app/globals.css";
import "./mobile.css";
import "./phone.css";

const embedded = new URLSearchParams(window.location.search).get("app") === "1" || document.documentElement.dataset.jombitApp === "true";
const phoneDemo = new URLSearchParams(window.location.search).get("view") === "demo" || document.documentElement.dataset.jombitView === "demo";
let offlineDocument: string | undefined;
if (!embedded && phoneDemo && window.location.protocol === "file:") {
  const copy = document.documentElement.cloneNode(true) as HTMLElement;
  copy.dataset.jombitApp = "true";
  offlineDocument = `<!doctype html>${copy.outerHTML}`;
}
document.documentElement.classList.add(embedded ? "app-view" : phoneDemo ? "showcase-view" : "marketing-view");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{embedded ? <JomBitApp /> : phoneDemo ? <PhonePreview appDocument={offlineDocument} /> : <MarketingSite />}</StrictMode>,
);
