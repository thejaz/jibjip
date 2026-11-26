import { mountJibjip, type RuntimeProfile } from "@jibjip/core";
import "@jibjip/core/style.css";
import "./platform-icons";

declare const __JIBJIP_RUNTIME_PROFILE__: RuntimeProfile;
if (__JIBJIP_RUNTIME_PROFILE__ === "public") {
  void import("./analytics").then(({ setupHomepageAnalytics }) => setupHomepageAnalytics()).catch(() => {
    // Optional statistics must never prevent the visitor homepage from opening.
  });
}
const container = document.getElementById("root");
if (!container) throw new Error("JIBJIP could not find its application root.");
void mountJibjip({ container, view: "introduction", profile: __JIBJIP_RUNTIME_PROFILE__ });
