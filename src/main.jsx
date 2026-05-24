import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./presentation/UI/ErrorBoundary";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
