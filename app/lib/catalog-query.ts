import { useSearchParams } from "react-router";

export function useCatalogQuery(filterKeys: readonly string[]) {
  const [params, setParams] = useSearchParams();
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { preventScrollReset: true, replace: key === "q" },
    );
  const reset = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of filterKeys) next.delete(key);
        return next;
      },
      { preventScrollReset: true },
    );
  return {
    params,
    update,
    reset,
    list: params.get("view") === "list",
    filtered: filterKeys.some((key) => !!params.get(key)),
  };
}
