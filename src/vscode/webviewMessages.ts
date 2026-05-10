import { ContextMode, ContextSelection, TokenBudget, TokenizerProfile } from "../core/types";
import { ContextPreviewResult } from "../core/contextPreview";
import { PatchPreview } from "../core/patch/patchTypes";
import { PersistedValidationRunResult } from "../core/validation/validationHistory";
import { FileSearchResult } from "./filePicker";
import { TaskProfile } from "./taskProfiles";

export type IncludeMode = ContextSelection["includeMode"];

export type WebviewToExtensionMessage =
  | { type: "scanRepo" }
  | { type: "setTask"; task: string }
  | { type: "setMode"; mode: ContextMode }
  | { type: "setContextLimit"; limit: number }
  | { type: "setTokenizerProfile"; profile: TokenizerProfile }
  | { type: "setReservedOutput"; tokens: number }
  | { type: "searchFiles"; query: string }
  | { type: "addFile"; path: string; includeMode: IncludeMode }
  | { type: "removeFile"; path: string }
  | { type: "setIncludeMode"; path: string; includeMode: IncludeMode }
  | { type: "generatePack" }
  | { type: "copyPack" }
  | { type: "openLastPack" }
  | { type: "parsePatchFromClipboard" }
  | { type: "previewPatch" }
  | { type: "applyLastPatch" }
  | { type: "runValidation" }
  | { type: "openLastPatch" }
  | { type: "openLastValidation" }
  | { type: "clearSelection" }
  | { type: "saveTaskProfile"; name: string };

export interface WebviewState {
  task: string;
  mode: ContextMode;
  contextLimit: number;
  reservedOutput: number;
  tokenizerProfile: TokenizerProfile;
  selectedFiles: ContextSelection[];
  scanSummary: string;
  tokenBudget?: TokenBudget;
  preview?: ContextPreviewResult;
  searchResults: FileSearchResult[];
  profiles: TaskProfile[];
  lastPackPath?: string;
  patchPreview?: PatchPreview;
  validationResult?: PersistedValidationRunResult;
}

export type ExtensionToWebviewMessage =
  | { type: "state"; state: WebviewState }
  | { type: "scanProgress"; message: string; done?: boolean }
  | { type: "error"; message: string }
  | { type: "info"; message: string };
