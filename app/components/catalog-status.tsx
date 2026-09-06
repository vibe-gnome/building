import { isRouteErrorResponse, Link, useRouteError } from "react-router";

export function CatalogLoading() {
  return (
    <main id="main-content" className="page-shell marketplace" tabIndex={-1}>
      <p role="status">Loading listings…</p>
    </main>
  );
}

export function CatalogError() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main id="main-content" className="page-shell error-page" tabIndex={-1}>
      <h1>
        {missing ? "Page not found" : "Listings are temporarily unavailable"}
      </h1>
      <p>
        {missing
          ? "This listing may have moved or been removed."
          : "Please try again in a moment."}
      </p>
      <button
        type="button"
        className="button"
        onClick={() => window.location.reload()}
      >
        Try again
      </button>{" "}
      <Link to="/" className="button">
        Home
      </Link>
    </main>
  );
}
