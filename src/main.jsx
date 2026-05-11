import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import Charts from "./Charts"

createRoot(document.getElementById("root")).render(
  <StrictMode><Charts /></StrictMode>
)
