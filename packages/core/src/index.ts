import { configureRuntime, type RuntimeProfile } from "./runtime";
import "./styles.css";

export type { RuntimeProfile } from "./runtime";
export interface MountOptions {
  container: HTMLElement;
  view: "introduction" | "application";
  profile: RuntimeProfile;
}

const mounted = new WeakSet<HTMLElement>();

/** Importing the entry does not load financial persistence or open IndexedDB. */
export async function mountJibjip(options: MountOptions): Promise<() => void> {
  if (!options?.container || options.container.nodeType !== 1) throw new Error("JIBJIP needs a container element.");
  if (options.view !== "introduction" && options.view !== "application") throw new Error("Unknown JIBJIP view.");
  if (mounted.has(options.container)) throw new Error("JIBJIP is already mounted in this container.");
  configureRuntime(options.profile);
  mounted.add(options.container);
  try {
    const { renderView } = await import("./render");
    const dispose = await renderView(options.container, options.view);
    return () => { dispose(); mounted.delete(options.container); };
  } catch (error) {
    mounted.delete(options.container);
    throw error;
  }
}
