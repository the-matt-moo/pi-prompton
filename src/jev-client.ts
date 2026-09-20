/**
 * Shared TypeSafe (Jev) System One client: Windows Credential Manager lookup
 * plus a generic `/v1/systemone` POST. Extracted from jev-intent.ts so score
 * and rewrite-verification judgments can reuse the same credential/transport
 * code instead of re-inlining the PowerShell credential reader.
 */

import { execFile } from "node:child_process";

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_CREDENTIAL_TARGET = "pi-bifrost/jev-api-key";
export const DEFAULT_MODEL = "jev-latest";
export const DEFAULT_TIMEOUT_MS = 5_000;

export interface JevClientOptions {
  /** API key for TypeSafe. If omitted, reads from Windows Credential Manager. */
  apiKey?: string | undefined;
  /** Credential Manager target. Default: `pi-bifrost/jev-api-key`. */
  credentialTarget?: string | undefined;
  /** Request timeout in ms. Default: 5000. */
  timeoutMs?: number | undefined;
  /** Custom fetch for testing. */
  fetch?: typeof globalThis.fetch | undefined;
  /** Custom credential reader for testing. */
  readCredential?: ((target: string) => Promise<string | undefined>) | undefined;
}

export interface SystemOneRequestBody {
  state: unknown;
  model: string;
  questions: Record<string, unknown>;
}

export interface SystemOneAnswer {
  choice?: string;
  confidence?: number;
  noul?: number;
  score?: number;
}

export interface SystemOneResponseBody {
  answers?: Record<string, SystemOneAnswer>;
  model?: string;
}

/** Resolve an API key from options, an explicit override, or Windows Credential Manager. */
export async function resolveJevApiKey(options: JevClientOptions): Promise<string | undefined> {
  return (
    options.apiKey ??
    (await (options.readCredential ?? readWindowsCredential)(
      options.credentialTarget ?? DEFAULT_CREDENTIAL_TARGET
    ))
  );
}

/** POST a System One request. Returns undefined on any non-2xx response. */
export async function callSystemOne(
  body: SystemOneRequestBody,
  apiKey: string,
  options: Pick<JevClientOptions, "fetch" | "timeoutMs">
): Promise<SystemOneResponseBody | undefined> {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const response = await fetchFn(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) return undefined;
  return (await response.json()) as SystemOneResponseBody;
}

// ---------- Windows Credential Manager ----------

const CREDENTIAL_SCRIPT = String.raw`
$source = @'
using System;
using System.Runtime.InteropServices;

public static class PromptyCredential {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct Credential {
    public UInt32 Flags;
    public UInt32 Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }

  [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, UInt32 type, UInt32 reserved, out IntPtr credential);

  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern void CredFree(IntPtr credential);

  public static string Read(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) {
      if (Marshal.GetLastWin32Error() == 1168) return null;
      throw new InvalidOperationException("Credential Manager read failed.");
    }

    try {
      Credential credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
      return credential.CredentialBlobSize == 0
        ? ""
        : Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
    }
    finally {
      CredFree(pointer);
    }
  }
}
'@
Add-Type -TypeDefinition $source
$value = [PromptyCredential]::Read($env:PROMPTON_CREDENTIAL_TARGET)
if ($null -eq $value) { exit 3 }
[Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($value)))
`;

const encodedScript = Buffer.from(CREDENTIAL_SCRIPT, "utf16le").toString("base64");
const credentialCache = new Map<string, string>();

export async function readWindowsCredential(target: string): Promise<string | undefined> {
  if (process.platform !== "win32" || !target.trim()) return undefined;
  const cached = credentialCache.get(target);
  if (cached !== undefined) return cached;

  const encoded = await new Promise<string | undefined>((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript],
      {
        env: {
          SystemRoot: process.env.SystemRoot,
          WINDIR: process.env.WINDIR,
          ComSpec: process.env.ComSpec,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          PROMPTON_CREDENTIAL_TARGET: target,
        },
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 16 * 1024,
        encoding: "utf8",
      },
      (error, stdout) => {
        if (error) {
          if ("code" in error && error.code === 3) resolve(undefined);
          else reject(new Error(`Unable to read Windows credential "${target}".`));
          return;
        }
        resolve(stdout.trim() || undefined);
      }
    );
  });

  if (!encoded) return undefined;
  const value = Buffer.from(encoded, "base64").toString("utf8");
  credentialCache.set(target, value);
  return value;
}
