import type { Asset } from "./commissioning";

type AssetField = "area" | "phase";

export function assetFieldOptions(assets: Asset[], field: AssetField) {
  return [
    ...new Set(
      assets
        .map((asset) => asset[field]?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((label) => ({ value: `value:${label}`, label }));
}

function matchesField(asset: Asset, field: AssetField, filter: string) {
  const value = asset[field]?.trim() || "";
  return (
    filter === "all" ||
    (filter === "missing" ? !value : filter === `value:${value}`)
  );
}

export function filterAssetRegister(
  assets: Asset[],
  filters: {
    query: string;
    supply: string;
    area: string;
    phase: string;
    programmeId?: string;
  },
) {
  const query = filters.query.trim().toLowerCase();
  return assets.filter(
    (asset) =>
      `${asset.id} ${asset.clientAssetId ?? ""} ${filters.programmeId ?? ""} ${asset.programmeActivityId ?? ""} ${asset.name} ${asset.equipmentType} ${asset.location} ${asset.phase ?? ""} ${asset.floor ?? ""} ${asset.area ?? ""} ${asset.discipline ?? ""} ${asset.parentAssetId ?? ""} ${asset.serialNumber ?? ""} ${asset.owner ?? ""} ${asset.deliveryActivityId ?? ""}`
        .toLowerCase()
        .includes(query) &&
      (filters.supply === "all" ||
        (filters.supply === "unknown"
          ? asset.clientSupplied == null
          : String(asset.clientSupplied) === filters.supply)) &&
      matchesField(asset, "area", filters.area) &&
      matchesField(asset, "phase", filters.phase),
  );
}
