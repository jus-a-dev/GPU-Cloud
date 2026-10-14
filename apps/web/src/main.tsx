import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Config } from "./pages/Config";
import { Notebooks } from "./pages/Notebooks";
import "./style.css";

function App() {
  const [tick, setTick] = useState(0);
  return (
    <main>
      <h1>GPU Cloud</h1>
      <Config onCreated={() => setTick((t) => t + 1)} />
      <Notebooks refreshKey={tick} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
