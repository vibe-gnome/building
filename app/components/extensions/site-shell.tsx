import { Link, NavLink } from "react-router";
import { AppearanceControl } from "../appearance-control";

function Brand() {
  return (
    <span className="brand">
      <svg aria-hidden="true" className="brand-logo" viewBox="0 0 1024 1024">
        <title>Vibe GNOME</title>
        <use href="/logo.svg#paw-print" />
      </svg>
    </span>
  );
}

export function ExtensionsHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" aria-label="Vibe GNOME home">
          <Brand />
        </Link>
        <nav className="project-nav" aria-label="Vibe GNOME">
          <NavLink to="/apps">Apps</NavLink>
          <NavLink to="/extensions">Extensions</NavLink>
          <NavLink to="/skills">Skills</NavLink>
        </nav>
        <AppearanceControl />
      </div>
    </header>
  );
}
