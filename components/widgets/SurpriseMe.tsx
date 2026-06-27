"use client";
import { useEffect, useState } from "react";
import { useHala } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";

const STEP_LABELS = ["Who", "Budget", "Vibe"];

interface QuizOption {
  /** Natural-language fragment fed into the search brief. */
  value: string;
  /** Short button label. */
  label: string;
  /** Leading emoji. */
  emoji: string;
}
interface SurpriseQuiz {
  recipients: QuizOption[];
  budgets: QuizOption[];
  vibes: QuizOption[];
}

// Local resilience fallback only — the real options come from /api/surprise
// (LLM-generated, grounded in live Snoonu categories, varies each session).
const FALLBACK_QUIZ: SurpriseQuiz = {
  recipients: [
    { value: "my partner", label: "Partner", emoji: "💖" },
    { value: "my mum", label: "Mum", emoji: "🌷" },
    { value: "my dad", label: "Dad", emoji: "☕" },
    { value: "a friend", label: "A friend", emoji: "🥂" },
    { value: "a kid", label: "A kid", emoji: "🎈" },
    { value: "anyone", label: "Anyone", emoji: "✨" },
  ],
  budgets: [
    { value: "under Rs 5000", label: "Under 5k", emoji: "💸" },
    { value: "around Rs 10000", label: "5k–15k", emoji: "🎁" },
    { value: "premium", label: "Premium", emoji: "👑" },
  ],
  vibes: [
    {
      value: "sweet romantic flowers and chocolate",
      label: "Romantic",
      emoji: "🌹",
    },
    { value: "fun playful gift hamper", label: "Playful", emoji: "🎉" },
    { value: "elegant jewellery", label: "Elegant", emoji: "💎" },
    { value: "tasty cake and treats", label: "Treats", emoji: "🍰" },
  ],
};

/**
 * 3-tap concierge. Options are fetched live (dynamic, never hardcoded). On
 * completion it composes a natural-language brief and hands it to the agent,
 * which performs the real MCP search.
 */
export function SurpriseMe({
  onComplete,
}: {
  onComplete: (brief: string) => void;
}) {
  const lang = useHala((state) => state.lang);
  const translate = useTranslate();
  const [quiz, setQuiz] = useState<SurpriseQuiz | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [recipient, setRecipient] = useState<QuizOption | null>(null);
  const [budget, setBudget] = useState<QuizOption | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/surprise?lang=" + lang)
      .then((response) => response.json())
      .then((data) => {
        if (active) setQuiz((data?.quiz as SurpriseQuiz) || FALLBACK_QUIZ);
      })
      .catch(() => {
        if (active) setQuiz(FALLBACK_QUIZ);
      });
    return () => {
      active = false;
    };
  }, [lang]);

  const loading = !quiz;
  const options = !quiz
    ? []
    : stepIndex === 0
      ? quiz.recipients
      : stepIndex === 1
        ? quiz.budgets
        : quiz.vibes;
  const questionLabel =
    stepIndex === 0
      ? translate("Who's it for?")
      : stepIndex === 1
        ? translate("What's the budget?")
        : translate("Pick a vibe");

  function choose(option: QuizOption) {
    if (stepIndex === 0) {
      setRecipient(option);
      setStepIndex(1);
    } else if (stepIndex === 1) {
      setBudget(option);
      setStepIndex(2);
    } else {
      onComplete(
        `Surprise me with a ${option.value} gift for ${
          recipient?.value ?? "someone"
        }, ${budget?.value ?? "any budget"}.`,
      );
    }
  }

  return (
    <div className="surprise">
      <div className="surprise-h">
        <span className="surprise-icon">🎁</span>
        <div className="surprise-h-txt">
          <h4>{translate("Surprise me")}</h4>
          <div className="sub">
            {translate("Three quick taps → a hand-picked gift")}
          </div>
        </div>
      </div>

      {/* Labelled progress */}
      <div className="surprise-steps">
        {STEP_LABELS.map((label, index) => (
          <div
            key={label}
            className={"sstep" + (stepIndex >= index ? " on" : "")}
          >
            <span className="sstep-bar" />
            <span className="sstep-lbl">{translate(label)}</span>
          </div>
        ))}
      </div>

      <div className="surprise-q">
        <div className="surprise-q-head">
          {stepIndex > 0 && (
            <button
              className="surprise-back"
              onClick={() => setStepIndex((current) => current - 1)}
              aria-label={translate("Go back")}
            >
              ←
            </button>
          )}
          <div className="surprise-qlbl">{questionLabel}</div>
        </div>

        {/* Breadcrumb of choices so far */}
        {(recipient || budget) && (
          <div className="surprise-crumbs">
            {recipient && (
              <button className="scrumb" onClick={() => setStepIndex(0)}>
                {recipient.emoji} {translate(recipient.label)}
              </button>
            )}
            {budget && (
              <button className="scrumb" onClick={() => setStepIndex(1)}>
                {budget.emoji} {translate(budget.label)}
              </button>
            )}
          </div>
        )}

        <div className="surprise-opts">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="surprise-opt skel" />
              ))
            : options.map((option) => (
                <button
                  key={option.value + option.label}
                  className="surprise-opt"
                  onClick={() => choose(option)}
                >
                  <span className="surprise-opt-e">{option.emoji}</span>
                  <span>{translate(option.label)}</span>
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}
