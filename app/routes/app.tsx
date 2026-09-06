import {
  CommunityDetail,
  communityDetailMeta,
} from "../components/community-detail";
import { loadListing } from "../lib/catalog-client";
import type { Route } from "./+types/app";

export {
  CatalogError as ErrorBoundary,
  CatalogLoading as HydrateFallback,
} from "../components/catalog-status";

export function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  return loadListing("apps", params.slug, request.signal);
}

export function meta({ data }: Route.MetaArgs) {
  return communityDetailMeta(data);
}

export default function App({ loaderData }: Route.ComponentProps) {
  return <CommunityDetail category="apps" data={loaderData} />;
}
