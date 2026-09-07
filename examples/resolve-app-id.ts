import { resolveAppIdentity } from "../app/server/app-identity";

const repository = process.argv[2];
if (!repository)
  throw new Error("Usage: bun examples/resolve-app-id.ts <repository-url>");
console.log(JSON.stringify(await resolveAppIdentity(repository), null, 2));
