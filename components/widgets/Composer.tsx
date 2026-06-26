import React, { useEffect, useRef, useState } from "react";
import VoiceOverlay from "../ui/VoiceOverlay";
import { TextInput } from "../ui/TextInput";
import VoiceInput from "../ui/VoiceInput";
import { PhotoUploadButton } from "./PhotoUploadButton";
import { VoiceSettings } from "./VoiceSettings";
import { Icon } from "../ui/Icon";
import { CommandPalette } from "./CommandPalette";
import { ChatAutosuggest } from "./ChatAutosuggest";
import { saveRecent } from "@/lib/catalog/recents";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useTrova } from "@/store";
import { matchCommand, type CommandId } from "@/lib/ui/commands";
import Link from "next/link";
import { useTranslate } from "@/hooks/useTranslate";

// Fully store-driven — no props. The composer is the chat input bar plus the
// slash-command menu, and drives every action through the store.
const Composer: React.FC = () => {
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const lang = useTrova((store) => store.lang);
  const playing = useTrova((store) => store.playing);
  const messages = useTrova((store) => store.messages);
  const clearThread = useTrova((store) => store.clearThread);
  const showToast = useTrova((store) => store.showToast);
  const userSend = useTrova((store) => store.userSend);
  const pushAttach = useTrova((store) => store.pushAttach);
  const setCartOpen = useTrova((store) => store.setCartOpen);
  const setOrdersOpen = useTrova((store) => store.setOrdersOpen);
  const startTracking = useTrova((store) => store.startTracking);
  const startDelivery = useTrova((store) => store.startDelivery);
  const pushWatchlistUpdate = useTrova((store) => store.pushWatchlistUpdate);
  const stopGeneration = useTrova((store) => store.stopGeneration);
  const translate = useTranslate();

  const [textInput, setTextInput] = useState("");
  const [textInputFocused, setTextInputFocused] = useState(false);
  // Picked photos wait here so the user can add a prompt before sending.
  const [stagedImages, setStagedImages] = useState<string[]>([]);

  const conversing = messages.length > 0;

  // An "edit" tap on a past user message publishes its text via the store. We
  // subscribe to that external change and load it into the input from the
  // subscription callback (the React-recommended place to setState in response
  // to an external system — not synchronously in the effect body).
  useEffect(() => {
    return useTrova.subscribe((state, prev) => {
      const draft = state.composerDraft;
      if (draft == null || draft === prev.composerDraft) return;
      setTextInput(draft);
      setTextInputFocused(false);
      useTrova.getState().setComposerDraft(null);
      const current = textInputRef.current;
      if (current) {
        current.focus();
        // Caret at the end so the user can keep typing immediately.
        requestAnimationFrame(() =>
          current.setSelectionRange(draft.length, draft.length),
        );
      }
    });
  }, []);

  // Voice fills the input only — the user reviews and taps send (no auto-send).
  // On finish we focus the box so they can edit/send right away.
  const voice = useVoiceInput((text, isFinal) => {
    setTextInput(text);
    if (isFinal) textInputRef.current?.focus();
  });

  function openTools() {
    setTextInput("/");
    setTextInputFocused(true);
    textInputRef.current?.focus();
  }

  function handleSend(text?: string) {
    const value = (text ?? textInput).trim();
    if (playing) return;
    // Stop any active voice recording so the mic doesn't keep "listening".
    if (voice.active) voice.stop();

    // Photo search: send the staged image(s) with the typed prompt (or default).
    if (stagedImages.length) {
      const prompt = value || translate("Find something like this 📷");
      setTextInput("");
      setTextInputFocused(false);
      setStagedImages([]);
      userSend(prompt, { images: stagedImages });
      return;
    }

    if (!value) return;
    // A "/command" runs an action instead of messaging the agent.
    if (value.startsWith("/")) {
      const command = matchCommand(value);
      if (command) runCommand(command.id);
      else showToast(translate("Unknown command — type / to see options"));
      return;
    }
    saveRecent(value);
    setTextInput("");
    setTextInputFocused(false);
    userSend(value);
  }

  const MAX_PHOTOS = 4;
  function handlePhoto(dataUrls: string[]) {
    if (playing || !dataUrls.length) return;
    if (voice.active) voice.stop();
    // Stage the photo(s) so the user can add a prompt before sending — capped
    // at MAX_PHOTOS. Compute overflow from the current state, then toast OUTSIDE
    // the updater (a state updater must be pure — toasting in it would update
    // another component mid-render).
    const overflow = stagedImages.length + dataUrls.length > MAX_PHOTOS;
    setStagedImages((current) =>
      [...current, ...dataUrls].slice(0, MAX_PHOTOS),
    );
    if (overflow)
      showToast(
        translate("Up to {max} photos per search", { max: MAX_PHOTOS }),
      );
    textInputRef.current?.focus();
  }

  /** Run a slash command (the quick-action menu). */
  function runCommand(id: CommandId) {
    setTextInput("");
    setTextInputFocused(false);
    switch (id) {
      case "surprise":
        pushAttach({ kind: "surprise" });
        break;
      case "autobuy":
        userSend(translate("pick and order for me"));
        break;
      case "hamper":
        pushAttach({ kind: "hamper" });
        break;
      case "kit":
        pushAttach({ kind: "kit" });
        break;
      case "countdown":
        pushAttach({ kind: "countdown" });
        break;
      case "cart":
        setCartOpen(true);
        break;
      case "orders":
        setOrdersOpen(true);
        break;
      case "watchlist":
        pushWatchlistUpdate();
        break;
      case "track":
        startTracking();
        break;
      case "checkout":
        startDelivery();
        break;
      case "clear":
        clearThread();
        break;
    }
  }

  return (
    <div className="composer-wrap">
      <VoiceOverlay
        voiceActive={voice.active}
        voiceStop={voice.stop}
        transcript={voice.active ? textInput : ""}
      />

      <div className="bottom-card">
        <div className="inbar" style={{ marginTop: conversing ? 0 : 6 }}>
          {textInputFocused && !playing && textInput.startsWith("/") ? (
            <CommandPalette
              query={textInput}
              onRun={runCommand}
              onClose={() => setTextInputFocused(false)}
            />
          ) : (
            textInputFocused &&
            !playing && (
              <ChatAutosuggest
                query={textInput}
                onPick={(text) => handleSend(text)}
                onClose={() => setTextInputFocused(false)}
              />
            )
          )}
          {stagedImages.length > 0 && (
            <div className="staged-images">
              {stagedImages.map((src, index) => (
                <div className="staged-image" key={index}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Attached photo ${index + 1}`} />
                  <button
                    className="staged-image-x"
                    onClick={() =>
                      setStagedImages((current) =>
                        current.filter((_, position) => position !== index),
                      )
                    }
                    aria-label={translate("Remove photo")}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="inbar-top">
            <TextInput
              input={textInput}
              inputRef={textInputRef}
              setTextInputFocused={setTextInputFocused}
              setTextInput={setTextInput}
              handleSend={handleSend}
            />
            <VoiceInput
              active={voice.active}
              lang={lang}
              start={voice.start}
              stop={voice.stop}
            />
          </div>

          <div className="inbar-actions">
            <div className="inbar-left">
              <PhotoUploadButton onUpload={handlePhoto} />
              <button
                className="tools-btn"
                onClick={openTools}
                title={translate("Quick commands")}
                aria-label={translate("Open quick commands")}
              >
                <Icon name="command" size={18} />
              </button>
              <VoiceSettings />
            </div>
            {playing ? (
              <button
                className="sendbtn stopbtn"
                onClick={() => stopGeneration()}
                aria-label={translate("Stop")}
                title={translate("Stop")}
              >
                <Icon name="stop" size={15} />
              </button>
            ) : (
              <button
                className="sendbtn"
                disabled={!textInput.trim() && !stagedImages.length}
                onClick={() => handleSend()}
                aria-label={translate("Send")}
              >
                <Icon name="arrow" size={19} />
              </button>
            )}
          </div>
        </div>

        <div className="composer-hint">
          {translate(
            "Type / for quick commands · real snoonu catalog · no sign-up",
          )}
          <br /> {translate("Made with ❤️ by")}{" "}
          <Link
            className="underline"
            href={"https://www.linkedin.com/in/mohamed-safras-aw/"}
          >
            {translate("Mohamed Safras")}
          </Link>{" "}
          🇱🇰
        </div>
      </div>
    </div>
  );
};

export default Composer;
