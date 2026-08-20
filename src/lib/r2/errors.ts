export class MasterDataUnavailableError extends Error {
  constructor(message = "Master data is temporarily unavailable") {
    super(message);
    this.name = "MasterDataUnavailableError";
  }
}

export class MasterObjectNotFoundError extends Error {
  constructor() {
    super("Requested master record was not found");
    this.name = "MasterObjectNotFoundError";
  }
}

/** Strip internal details before surfacing errors to clients. */
export function toPublicMasterError(error: unknown): { message: string; code: string } {
  if (error instanceof MasterObjectNotFoundError) {
    return { message: "Not found", code: "NOT_FOUND" };
  }
  return { message: "Master data unavailable", code: "UNAVAILABLE" };
}
