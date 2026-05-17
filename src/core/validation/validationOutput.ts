import { stripVTControlCharacters } from "node:util";
import { ValidationRunResult } from "./validationTypes";

export function sanitizeValidationRunResult(result: ValidationRunResult): ValidationRunResult {
  return {
    ...result,
    stdout: stripVTControlCharacters(result.stdout),
    stderr: stripVTControlCharacters(result.stderr)
  };
}
