import { ArrowUpRight } from "lucide-react";
import { Link, NavLink } from "react-router";

export function SiteFooter() {
  return (
    <footer>
      <div className="footer-inner page-shell">
        <div className="footer-identity">
          <Link aria-label="Vibe GNOME home" className="brand" to="/">
            <svg
              className="brand-logo"
              focusable="false"
              role="img"
              viewBox="0 0 1024 1024"
            >
              <title>Vibe GNOME home</title>
              <use href="/logo.svg#paw-print" />
            </svg>
          </Link>
          <p className="footer-disclaimer">
            Vibe GNOME is an independent community project and is not affiliated
            with or endorsed by the GNOME Foundation.
          </p>
        </div>
        <nav aria-label="Community links" className="footer-links">
          <NavLink to="/about">About</NavLink>
          <a
            href="https://github.com/orgs/vibe-gnome"
            rel="noreferrer"
            target="_blank"
          >
            GitHub <ArrowUpRight aria-hidden="true" size={15} />
          </a>
          <a
            href="https://www.reddit.com/r/vibe_gnome/"
            rel="noreferrer"
            target="_blank"
          >
            r/vibe_gnome <ArrowUpRight aria-hidden="true" size={15} />
          </a>
        </nav>
      </div>
    </footer>
  );
}
