export { resolveMasterR2Binding } from "./binding";
export { MasterDataUnavailableError, MasterObjectNotFoundError, toPublicMasterError } from "./errors";
export {
  identityKey,
  metadataKey,
  semanticKey,
  searchKey,
  provenanceKey,
  artworkRecordKey,
  artworkBinaryKey,
  manifestKey,
  licenseKey,
  safeCanonicalFileName,
} from "./keys";
export {
  isArtworkPubliclyServable,
  loadLicenseMatrix,
  getProviderServingClass,
  resetLicenseMatrixCache,
} from "./license-matrix";
export {
  MasterR2Adapter,
  getMasterR2Adapter,
  resetMasterR2AdapterCache,
  getEmojiMasterBundle,
  getPublicIdentityR2Payload,
  resetPublicIdentityPayloadCache,
  getArtworkBinaryForRecord,
} from "./master-r2";
export type { MasterR2Options } from "./master-r2";
export {
  isR2MasterBackendConfigured,
  isR2MetadataBackendActive,
  isR2ArtworkBackendActive,
  isR2SearchBackendActive,
  searchMasterViaR2,
  mapSearchRecordToUiFields,
} from "./integration";
export type {
  R2BucketBinding,
  CanonicalIdentityRecord,
  CanonicalSearchRecord,
  CanonicalArtworkRecord,
  LicenseMatrix,
  MasterR2ReadResult,
} from "./types";
