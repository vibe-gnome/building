import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export function meta() {
  return [
    { title: "Page not found | Vibe GNOME" },
    { name: "robots", content: "noindex" },
  ];
}
export default function NotFound() {
  return (
    <main id="main-content" className="page-shell error-page" tabIndex={-1}>
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>This listing may have moved or been removed.</p>
      <Link className="button primary" to="/extensions">
        <ArrowLeft size={16} aria-hidden="true" />
        Browse extensions
      </Link>
    </main>
  );
}
