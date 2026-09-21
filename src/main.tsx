import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { getConvexUrl } from "@convex-dev/static-hosting";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import "./index.css";

const convex = new ConvexReactClient((import.meta.env.VITE_CONVEX_URL as string | undefined) ?? getConvexUrl());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>,
);
