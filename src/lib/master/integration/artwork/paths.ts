const EXTERNAL_PATH_PATTERN = /^https?:\/\//i;

export function isLocalArtworkPath(path: string): boolean {
  if (!path || EXTERNAL_PATH_PATTERN.test(path)) {
    return false;
  }
  return path.startsWith("public/");
}

export function assertLocalArtworkPath(path: string): string {
  if (!isLocalArtworkPath(path)) {
    throw new Error(`Artwork path must be a local frozen asset: ${path}`);
  }
  return path;
}

export function toRuntimeArtworkPath(publicPath: string): string {
  assertLocalArtworkPath(publicPath);
  return `/${publicPath.replace(/^public\//, "")}`;
}

export function toFrozenAssetPath(publicPath: string, masterRawRoot: string): string {
  assertLocalArtworkPath(publicPath);
  const relative = publicPath.replace(/^public\//, "");
  return `${masterRawRoot}/artwork/${relative}`;
}
