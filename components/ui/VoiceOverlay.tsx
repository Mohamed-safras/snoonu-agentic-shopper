"use client";
import React from "react";
import { useTranslate } from "@/hooks/useTranslate";

export interface VoiceOverlayProps {
  voiceActive: boolean;
  voiceStop: () => void;
  /** Live transcript so far — shown as feedback that words are being heard. */
  transcript?: string;
}

const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  voiceActive,
  voiceStop,
  transcript,
}) => {
  const translate = useTranslate();
  const heard = (transcript || "").trim();
  return (
    <React.Fragment>
      {voiceActive && (
        <div className="voice-overlay">
          <div className="voice-bars">
            {Array.from({ length: 13 }).map((_, i) => (
              <span key={i} className="voice-bar" />
            ))}
          </div>
          <div className="voice-label">{translate("Listening…")}</div>
          {heard && <div className="voice-heard">{heard}</div>}
          <button className="voice-dismiss" onClick={() => voiceStop()}>
            {heard ? translate("Done") : translate("Tap to dismiss")}
          </button>
        </div>
      )}
    </React.Fragment>
  );
};

export default VoiceOverlay;
