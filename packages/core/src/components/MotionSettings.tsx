"use client";

import { useEffect, useId } from "react";
import { useI18n } from "../lib/i18n";
import type { MotionLevel } from "../lib/types";
import "./motion.css";

/** Document scope includes setup, native dialogs, and the mobile drawer. */
export function useMotionPreference(level: MotionLevel) {
  useEffect(() => {
    document.documentElement.dataset.motion = level;
    return () => { delete document.documentElement.dataset.motion; };
  }, [level]);
}

export function MotionSettings({ value, onChange }: {
  value: MotionLevel;
  onChange: (value: MotionLevel) => Promise<void>;
}) {
  const { t } = useI18n();
  const id = useId();
  return <div className="display-setting-group motion-settings">
    <div className="panel-heading"><div><h3 id={`${id}-title`}>{t("settings.motion")}</h3><p>{t("settings.motionDescription")}</p></div></div>
    <fieldset className="motion-options" aria-labelledby={`${id}-title`} aria-describedby={`${id}-note`}>
      {(["off", "subtle", "enhanced"] as const).map(level => <label key={level} className={value === level ? "selected" : ""}>
        <input type="radio" name={`${id}-motion`} value={level} checked={value === level} onChange={() => { void onChange(level); }} />
        <span><strong>{t(`settings.motion.${level}`)}</strong><small>{t(`settings.motion.${level}Description`)}</small></span>
      </label>)}
    </fieldset>
    <p className="motion-note" id={`${id}-note`}>{t("settings.motionReduced")}</p>
  </div>;
}
