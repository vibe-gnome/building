import { Link, NavLink, useMatch } from "react-router";
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
  const appsMatch = useMatch("/apps/*");
  const extensionsMatch = useMatch("/extensions/*");
  const guidesMatch = useMatch("/guides/*");

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" aria-label="Vibe GNOME home">
          <Brand />
        </Link>
        {!guidesMatch && (
          <nav className="project-nav" aria-label="Vibe GNOME">
            <NavLink to="/apps">Apps</NavLink>
            <NavLink to="/extensions">Extensions</NavLink>
            {!appsMatch && !extensionsMatch && (
              <>
                <NavLink to="/skills">Skills</NavLink>
                <NavLink to="/guides">Guides</NavLink>
              </>
            )}
          </nav>
        )}
        <AppearanceControl />
      </div>
    </header>
  );
}
