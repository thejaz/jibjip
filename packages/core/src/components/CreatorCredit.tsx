"use client";

import { APP_CREATOR } from "../lib/brand";
import { useI18n } from "../lib/i18n";

export function CreatorCredit() {
  const { t } = useI18n();
  return <span className="creator-credit">
    <span>{t("common.createdBy")}</span>{" "}
    <a href={APP_CREATOR.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><bdi dir="ltr">{APP_CREATOR.name}</bdi></a>
  </span>;
}
