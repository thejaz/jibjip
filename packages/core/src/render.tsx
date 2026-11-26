import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { MountOptions } from "./index";

export async function renderView(container: HTMLElement, view: MountOptions["view"]): Promise<() => void> {
  const Component = view === "introduction"
    ? (await import("./components/HomePage")).HomePage
    : (await import("./components/JibjipApp")).JibjipApp;
  const root = createRoot(container);
  root.render(<StrictMode><Component /></StrictMode>);
  return () => root.unmount();
}
