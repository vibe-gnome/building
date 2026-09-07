import {
  CommunityDetail,
  communityDetailMeta,
} from "../components/community-detail";
import { loadListingPage } from "../lib/listing-loader";
import type { Route } from "./+types/skill";

export {
  CatalogError as ErrorBoundary,
  CatalogLoading as HydrateFallback,
} from "../components/catalog-status";

export function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  return loadListingPage("skills", params, request);
}

export function meta({ data }: Route.MetaArgs) {
  return communityDetailMeta(data);
}

export default function Skill({ loaderData }: Route.ComponentProps) {
  return <CommunityDetail category="skills" data={loaderData} />;
}
