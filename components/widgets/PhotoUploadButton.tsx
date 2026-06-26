"use client";
import { useRef, useState } from "react";
import { useTranslate } from "@/hooks/useTranslate";

/** Reads chosen image files into base64 data URLs (in order). */
function readFiles(
  files: FileList,
  done: (dataUrls: string[]) => void,
): void {
  const list = Array.from(files);
  if (!list.length) return;
  const results: string[] = new Array(list.length);
  let remaining = list.length;
  list.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string")
        results[index] = event.target.result;
      if (--remaining === 0) done(results.filter(Boolean));
    };
    reader.onerror = () => {
      if (--remaining === 0) done(results.filter(Boolean));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Photo-search button. Opens a small menu to either take a picture with the
 * camera or pick one/several images from the gallery; returns them as base64
 * data URLs (images only).
 */
export function PhotoUploadButton({
  onUpload,
}: {
  onUpload: (dataUrls: string[]) => void;
}) {
  const translate = useTranslate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const handle = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) readFiles(event.target.files, onUpload);
    event.target.value = "";
    setOpen(false);
  };

  // Open a hidden file input from a user gesture. Some mobile browsers ignore
  // .click() on a display:none input, so the inputs are visually-hidden (still
  // in layout) and we close the menu on the next frame — never before click().
  const openPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    ref.current?.click();
    requestAnimationFrame(() => setOpen(false));
  };

  return (
    <div className="photo-wrap">
      {/* Camera: single shot. Gallery: one or more images. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={handle}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        onChange={handle}
      />

      {open && (
        <>
          <div className="photo-menu-scrim" onClick={() => setOpen(false)} />
          <div className="photo-menu" role="menu">
            <button onClick={() => openPicker(cameraRef)}>
              📷 {translate("Take a photo")}
            </button>
            <button onClick={() => openPicker(galleryRef)}>
              🖼️ {translate("From gallery")}
            </button>
          </div>
        </>
      )}

      <button
        className="photo-btn"
        title={translate("Search by photo — camera or gallery")}
        aria-label={translate("Search by photo")}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
    </div>
  );
}
