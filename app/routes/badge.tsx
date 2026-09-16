import { ArrowDownToLine, ArrowLeft, Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import {
  type BadgeFormat,
  type BadgeVariant,
  badgeLabel,
  badgePath,
  badgeSiteUrl,
  badgeSnippet,
  badgeVariants,
} from "../lib/badge";
import "../badge.css";

export function meta() {
  return [
    { title: "Add a listing badge | Vibe GNOME" },
    {
      name: "description",
      content:
        "Add a Listed on Vibe GNOME badge to your README, website, or docs. Choose a light or dark SVG and copy the Markdown or HTML embed.",
    },
  ];
}

function EmbedCode({ code, format }: { code: string; format: BadgeFormat }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const codeRef = useRef<HTMLTextAreaElement>(null);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      codeRef.current?.focus();
      codeRef.current?.select();
      setStatus("error");
    }
  }

  return (
    <>
      <textarea
        ref={codeRef}
        className="badge-code"
        aria-label={`${format === "markdown" ? "Markdown" : "HTML"} embed code`}
        readOnly
        spellCheck={false}
        value={code}
      />
      <div className="badge-copy-row">
        <button className="button primary" type="button" onClick={copyCode}>
          {status === "copied" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          {status === "copied" ? "Copied" : "Copy code"}
        </button>
        <p className="badge-copy-status" role="status">
          {status === "copied" && "Ready to paste into your project."}
          {status === "error" &&
            "Copy is unavailable. The code is selected; press Ctrl+C or ⌘C to copy."}
        </p>
      </div>
    </>
  );
}

export default function BadgeGuide() {
  const [variant, setVariant] = useState<BadgeVariant>("light");
  const [format, setFormat] = useState<BadgeFormat>("markdown");

  return (
    <main id="main-content" className="page-shell badge-page" tabIndex={-1}>
      <Link className="guides-back" to="/guides">
        <ArrowLeft size={16} aria-hidden="true" /> All guides
      </Link>

      <header className="badge-heading">
        <h1>A little badge. A shared community.</h1>
        <p>
          Listed on Vibe GNOME? Let people know. Add a badge to your project’s
          README, website, or docs and help more people find the community.
        </p>
      </header>

      <div className="badge-workspace">
        <section aria-labelledby="badge-style-heading">
          <h2 id="badge-style-heading">1. Choose your badge</h2>
          <p className="badge-step-description">
            A small paw print, with a place for your project.
          </p>
          <div className="badge-preview" data-variant={variant}>
            <a href={badgeSiteUrl} aria-label={`${badgeLabel} — preview link`}>
              <img
                src={badgePath(variant)}
                alt={badgeLabel}
                width={228}
                height={64}
              />
            </a>
            <span>Actual size · 228 × 64 px</span>
          </div>
          <fieldset className="badge-variants">
            <legend className="sr-only">Badge appearance</legend>
            {badgeVariants.map((choice) => (
              <label className="badge-variant" key={choice}>
                <input
                  type="radio"
                  name="badge-variant"
                  value={choice}
                  checked={variant === choice}
                  onChange={() => setVariant(choice)}
                />
                {choice === "light" ? "Light" : "Dark"}
              </label>
            ))}
          </fieldset>
          <a className="badge-download" href={badgePath(variant)} download>
            <ArrowDownToLine size={16} aria-hidden="true" /> Download SVG
          </a>
        </section>

        <section aria-labelledby="badge-code-heading">
          <h2 id="badge-code-heading">2. Copy the embed code</h2>
          <p className="badge-step-description">
            Choose the format that fits your project.
          </p>
          <fieldset className="badge-formats">
            <legend className="sr-only">Embed format</legend>
            <button
              type="button"
              aria-pressed={format === "markdown"}
              onClick={() => setFormat("markdown")}
            >
              Markdown
            </button>
            <button
              type="button"
              aria-pressed={format === "html"}
              onClick={() => setFormat("html")}
            >
              HTML
            </button>
          </fieldset>
          <p className="badge-format-help">
            {format === "markdown"
              ? "For GitHub READMEs and Markdown docs."
              : "For websites and HTML pages."}
          </p>
          <EmbedCode
            key={`${variant}-${format}`}
            code={badgeSnippet(variant, format)}
            format={format}
          />
        </section>
      </div>

      <section
        className="badge-instructions"
        aria-labelledby="badge-add-heading"
      >
        <h2 id="badge-add-heading">3. Give it a home</h2>
        <div className="badge-instruction-columns">
          <div>
            <h3>In your README</h3>
            <p>
              Paste the Markdown below your project title or alongside your
              other badges. Preview your README, then save the change.
            </p>
          </div>
          <div>
            <h3>On your website</h3>
            <p>
              Paste the HTML into your project page, footer, or About section.
              The image is hosted for you, so there’s nothing to upload.
            </p>
          </div>
        </div>
        <p className="badge-listing-tip">
          Want to link directly to your listing? Copy its URL from Vibe GNOME
          and replace the link destination in the code. Keep the image URL as it
          is.
        </p>
      </section>

      <aside className="badge-note" aria-label="Using the badge">
        <p>
          <strong>A listing, a little recognition.</strong> Use this badge for a
          project listed on Vibe GNOME. Keep the wording and proportions intact,
          and choose the version that works best with your page’s background.
        </p>
        <p>
          Looking for your project? Browse <Link to="/apps">apps</Link>,{" "}
          <Link to="/extensions">extensions</Link>, or{" "}
          <Link to="/skills">skills</Link>.
        </p>
      </aside>
    </main>
  );
}
