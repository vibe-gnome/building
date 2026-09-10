import { Outlet } from "react-router";
import { ExtensionsHeader } from "../components/extensions/site-shell";
import { SiteFooter } from "../components/site-footer";
import "../extensions.css";

export default function CommunityLayout() {
  return (
    <div className="community-layout">
      <div className="community-site">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <ExtensionsHeader />
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  );
}
