import { mountJibjip, type RuntimeProfile } from "@jibjip/core";
import "@jibjip/core/style.css";
import "./platform-icons";

declare const __JIBJIP_RUNTIME_PROFILE__: RuntimeProfile;
const container = document.getElementById("root");
if (!container) throw new Error("JIBJIP could not find its application root.");
void mountJibjip({ container, view: "application", profile: __JIBJIP_RUNTIME_PROFILE__ });
