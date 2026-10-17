import { ArrowUpRight, Check, Copy, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { listingSubmissionPrompt } from "../lib/listing-submissions";
import { type ShowcaseCategory, showcaseSubmissionUrl } from "../lib/showcases";
import "../submissions.css";

export function SubmitListingButton({
  category,
}: {
  category: ShowcaseCategory;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "copied" | "error"
  >("idle");
  const subject = category === "apps" ? "app" : "extension";
  const prompt = listingSubmissionPrompt(category);

  async function copyPrompt() {
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
    } catch {
      promptRef.current?.focus();
      promptRef.current?.select();
      setCopyState("error");
    }
  }

  return (
    <>
      <button
        className="button primary submit-button"
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setCopyState("idle");
          dialogRef.current?.showModal();
        }}
      >
        <Plus size={17} aria-hidden="true" />
        Submit {subject}
      </button>
      <dialog
        ref={dialogRef}
        className="submission-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <header className="submission-heading">
          <div>
            <h2 id={`${id}-title`}>Submit {subject}</h2>
            <p id={`${id}-description`}>Choose how to share your project.</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close submission options"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <section className="submission-option" aria-labelledby={`${id}-manual`}>
          <h3 id={`${id}-manual`}>Submit on GitHub</h3>
          <p>Fill out the issue form yourself. You'll need a GitHub account.</p>
          <a
            className="button"
            href={showcaseSubmissionUrl(category)}
            target="_blank"
            rel="noreferrer"
          >
            Open GitHub form
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </section>
        <section className="submission-option" aria-labelledby={`${id}-agent`}>
          <h3 id={`${id}-agent`}>Submit with an agent</h3>
          <p>Copy this prompt into your coding agent in your project.</p>
          <textarea
            ref={promptRef}
            className="submission-prompt"
            aria-label={`${subject === "app" ? "App" : "Extension"} submission prompt`}
            readOnly
            spellCheck={false}
            value={prompt}
          />
          <div className="submission-copy-row">
            <button
              className="button primary"
              type="button"
              onClick={copyPrompt}
              disabled={copyState === "copying"}
            >
              {copyState === "copied" ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
              {copyState === "copied"
                ? "Copied"
                : copyState === "copying"
                  ? "Copying…"
                  : "Copy prompt"}
            </button>
            <p className="submission-copy-status" role="status">
              {copyState === "copied" && "Ready to paste into your agent."}
              {copyState === "error" &&
                "Copy is unavailable. The prompt is selected; press Ctrl+C or ⌘C to copy."}
            </p>
          </div>
        </section>
        <p className="submission-note">
          Both options create an issue for automated checks and maintainer
          review.
        </p>
      </dialog>
    </>
  );
}
