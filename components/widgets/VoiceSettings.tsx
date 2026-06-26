"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useTrova } from "@/store";
import { VOICE_OPTIONS_BY_LANGUAGE } from "@/lib/speech/voices";
import { languageName } from "@/lib/i18n/lang";
import { previewVoice, primeSpeech, stopSpeaking } from "@/lib/speech/speak";
import { useStrings, useTranslate } from "@/hooks/useTranslate";

/**
 * Composer Settings tab: turn read-aloud on/off and choose the speaking voice.
 * The voice list is scoped to the ACTIVE app language, so native Arabic /
 * Sinhala / Tamil speakers pick (and keep) a voice in their own language.
 * Picking a voice previews it — in that language — so the shopper hears it
 * first.
 */
export function VoiceSettings() {
  const language = useTrova((store) => store.lang);
  const speak = useTrova((store) => store.speak);
  const toggleSpeak = useTrova((store) => store.toggleSpeak);
  const voiceByLanguage = useTrova((store) => store.voiceByLanguage);
  const setVoiceForLanguage = useTrova((store) => store.setVoiceForLanguage);
  const strings = useStrings();
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const voiceOptions = VOICE_OPTIONS_BY_LANGUAGE[language];
  const selectedVoiceId = voiceByLanguage[language];

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node))
        setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onToggle() {
    if (speak) stopSpeaking();
    else primeSpeech(); // unlock audio within this user gesture
    toggleSpeak();
  }

  function pickVoice(voiceId: string) {
    setVoiceForLanguage(language, voiceId);
    primeSpeech();
    // Preview in the active language using its (translated) greeting.
    previewVoice(voiceId, language, strings.greet_title);
  }

  return (
    <div className="voice-settings" ref={wrapRef}>
      <button
        className={"tools-btn" + (open ? " on" : "")}
        onClick={() => setOpen((value) => !value)}
        title={translate("Settings")}
        aria-label={translate("Settings")}
        aria-expanded={open}
      >
        <Icon name="settings" size={18} />
      </button>

      {open && (
        <div
          className="voice-menu"
          role="dialog"
          aria-label={translate("Voice settings")}
        >
          <div className="voice-menu-head">
            <div className="voice-menu-title">
              <Icon name={speak ? "volume" : "volume-off"} size={15} />
              <span>{translate("Read replies aloud")}</span>
            </div>
            <button
              className={"voice-switch" + (speak ? " on" : "")}
              onClick={onToggle}
              role="switch"
              aria-checked={speak}
              aria-label={translate("Toggle read-aloud")}
            >
              <i />
            </button>
          </div>

          <div
            className={"voice-list" + (speak ? "" : " disabled")}
            aria-hidden={!speak}
          >
            <div className="voice-group-label">
              {translate("{name} voice", { name: languageName(language) })}
            </div>
            {voiceOptions.map((option) => (
              <button
                key={option.id}
                className={
                  "voice-menu-row" +
                  (option.id === selectedVoiceId ? " active" : "")
                }
                onClick={() => pickVoice(option.id)}
                role="radio"
                aria-checked={option.id === selectedVoiceId}
              >
                <span>{option.label}</span>
                {option.id === selectedVoiceId ? (
                  <Icon name="check" size={14} />
                ) : (
                  <Icon name="volume" size={13} />
                )}
              </button>
            ))}
          </div>
          <div className="voice-menu-hint">
            {translate("Tap a voice to hear it")}
          </div>
        </div>
      )}
    </div>
  );
}
