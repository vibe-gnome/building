import { resolveExtensionIdentity } from "../app/server/extension-identity";

const repository = process.argv[2];
if (!repository)
  throw new Error(
    "Usage: bun examples/resolve-extension-id.ts <public-repository-url>",
  );
console.log(
  JSON.stringify(await resolveExtensionIdentity(repository), null, 2),
);
