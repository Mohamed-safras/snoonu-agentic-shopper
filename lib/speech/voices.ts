import type { Lang } from "@/types";

/**
 * Microsoft Edge neural voices (free, no API key) offered per app language, so
 * native Arabic / Sinhala / Tamil speakers can pick a voice in their own
 * language. These are voice-engine identifiers (configuration, not catalog
 * data).
 */
export type VoiceGender = "female" | "male";

export interface VoiceOption {
  id: string;
  label: string;
  gender: VoiceGender;
}

// English: multilingual voices first — they handle code-switching (English
// mixed with local words) far more naturally than single-locale voices.
const ENGLISH_VOICES: VoiceOption[] = [
  { id: "en-US-AvaMultilingualNeural", label: "Ava · natural", gender: "female" },
  { id: "en-US-EmmaMultilingualNeural", label: "Emma · warm", gender: "female" },
  { id: "en-US-AriaNeural", label: "Aria · US", gender: "female" },
  { id: "en-GB-SoniaNeural", label: "Sonia · UK", gender: "female" },
  {
    id: "en-IN-NeerjaExpressiveNeural",
    label: "Neerja · India",
    gender: "female",
  },
  {
    id: "en-US-AndrewMultilingualNeural",
    label: "Andrew · natural",
    gender: "male",
  },
  { id: "en-US-BrianMultilingualNeural", label: "Brian · warm", gender: "male" },
  { id: "en-GB-RyanNeural", label: "Ryan · UK", gender: "male" },
  { id: "en-IN-PrabhatNeural", label: "Prabhat · India", gender: "male" },
];

// Qatari Arabic (ar-QA) first — matches the brand's home market — then Gulf/
// standard Arabic voices as alternatives.
const ARABIC_VOICES: VoiceOption[] = [
  { id: "ar-QA-AmalNeural", label: "أمل · Amal (QA)", gender: "female" },
  { id: "ar-QA-MoazNeural", label: "معاذ · Moaz (QA)", gender: "male" },
  { id: "ar-SA-ZariyahNeural", label: "زارية · Zariyah (SA)", gender: "female" },
  { id: "ar-SA-HamedNeural", label: "حامد · Hamed (SA)", gender: "male" },
];

const SINHALA_VOICES: VoiceOption[] = [
  { id: "si-LK-ThiliniNeural", label: "තිලිනි · Thilini", gender: "female" },
  { id: "si-LK-SameeraNeural", label: "සමීර · Sameera", gender: "male" },
];

// Sri Lankan Tamil (ta-LK) first — closest accent for local speakers — then the
// Indian Tamil voices as alternatives.
const TAMIL_VOICES: VoiceOption[] = [
  { id: "ta-LK-SaranyaNeural", label: "சரண்யா · Saranya (LK)", gender: "female" },
  { id: "ta-LK-KumarNeural", label: "குமார் · Kumar (LK)", gender: "male" },
  { id: "ta-IN-PallaviNeural", label: "பல்லவி · Pallavi (IN)", gender: "female" },
  {
    id: "ta-IN-ValluvarNeural",
    label: "வள்ளுவர் · Valluvar (IN)",
    gender: "male",
  },
];

export const VOICE_OPTIONS_BY_LANGUAGE: Record<Lang, VoiceOption[]> = {
  en: ENGLISH_VOICES,
  ar: ARABIC_VOICES,
  si: SINHALA_VOICES,
  ta: TAMIL_VOICES,
};

export const DEFAULT_VOICE_BY_LANGUAGE: Record<Lang, string> = {
  en: "en-US-AvaMultilingualNeural",
  ar: "ar-QA-AmalNeural",
  si: "si-LK-ThiliniNeural",
  ta: "ta-LK-SaranyaNeural",
};

/** The fallback voice for a language (when no valid override is supplied). */
export function defaultVoiceForLanguage(language: Lang | undefined): string {
  return (
    (language && DEFAULT_VOICE_BY_LANGUAGE[language]) ||
    DEFAULT_VOICE_BY_LANGUAGE.en
  );
}

/** Resolve the voice to synthesise with: the caller's chosen voice when provided
 *  (it's already language-appropriate), otherwise the language default. */
export function voiceFor(
  language: Lang | undefined,
  overrideVoiceId?: string,
): string {
  return overrideVoiceId || defaultVoiceForLanguage(language);
}
