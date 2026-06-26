import { Lang } from "@/types";
import React from "react";
import { Icon } from "./Icon";
import { useTranslate } from "@/hooks/useTranslate";

export interface VoiceInputProps {
  active: boolean;
  lang: Lang;
  start: (lang: Lang) => void;
  stop: () => void;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  active,
  lang,
  start,
  stop,
}) => {
  const translate = useTranslate();
  return (
    <button
      className={"mic" + (active ? " mic-on" : "")}
      onClick={() => (active ? stop() : start(lang))}
      title={translate("Voice input")}
    >
      <Icon name="mic" size={18} />
    </button>
  );
};

export default VoiceInput;
