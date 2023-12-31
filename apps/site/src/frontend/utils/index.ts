import { Agent, AnonymousIdentity, HttpAgent, Identity } from "@dfinity/agent";
import { InternalSnapClient } from "@fort-major/masquerade-client";
import { createStatisticsBackendActor } from "../backend";
import {
  ErrorCode,
  PRE_LISTED_TOKENS,
  TAccountId,
  debugStringify,
  err,
  hexToBytes,
  strToBytes,
} from "@fort-major/masquerade-shared";
import { JSX, JSXElement } from "solid-js";
import { IcrcLedgerCanister, IcrcMetadataResponseEntries } from "@dfinity/ledger-icrc";
import D from "dompurify";

// null = default
// <empty string> = ic
// <string> = custom host
export function setIcHost(host: string | null) {
  if (host === null) {
    localStorage.removeItem("msq-ic-host");
  } else {
    localStorage.setItem("msq-ic-host", JSON.stringify(host));
  }
}
export function getIcHost(): string | null {
  const host = localStorage.getItem("msq-ic-host");

  if (host === null) return null;

  return JSON.parse(host);
}

if (getIcHost() === null) {
  setIcHost(import.meta.env.VITE_MSQ_DFX_NETWORK_HOST);
}

(window as any).setIcHost = setIcHost;
(window as any).getIcHost = getIcHost;

export const DEFAULT_PRINCIPAL = "aaaaa-aaaaa-aaaaa-aaaaa-aaaaa-aaaaa-aaaaa-aaaaa-aaaaa-aaaaa";
export const DEFAULT_SUBACCOUNT = "ba35d85f5e781927cb545aa00048fd86cfb4f444baedd00baa701405251bf109";
export const ONE_SEC_MS = 1000;
export const ONE_MIN_MS = ONE_SEC_MS * 60;
export const ONE_HOUR_MS = ONE_MIN_MS * 60;
export const ONE_DAY_MS = ONE_HOUR_MS * 24;
export const ONE_WEEK_MS = ONE_DAY_MS * 7;

export async function handleStatistics(agent: Agent, client: InternalSnapClient) {
  const stats = await client.getStats();
  const now = Date.now();

  if (now - stats.lastResetTimestamp < ONE_DAY_MS) return;
  const statisticsBackend = createStatisticsBackendActor(agent);

  await client.resetStats();
  await statisticsBackend.increment_stats(stats.prod);
}

export interface IChildren {
  children: JSXElement;
}

export function timestampToStr(timestampMs: number) {
  const date = new Date(timestampMs);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export async function makeAgent(identity?: Identity | undefined, host?: string): Promise<Agent> {
  const storedHost = getIcHost();

  let icHost: string | undefined;
  if (host !== undefined) {
    icHost = host;
  } else {
    icHost = storedHost === null ? import.meta.env.VITE_MSQ_DFX_NETWORK_HOST : storedHost;
  }

  const agent = new HttpAgent({ host: icHost, identity });

  if (icHost) {
    await agent.fetchRootKey();
  }

  return agent;
}

export async function makeAnonymousAgent(host?: string): Promise<Agent> {
  const id = new AnonymousIdentity();
  return makeAgent(id, host);
}

export function tokensToStr(
  qty: bigint,
  decimals: number,
  padTail: boolean = false,
  insertQuotes: boolean = false,
): string {
  // 0.0 -> 0
  if (qty === BigInt(0)) {
    return "0";
  }

  // todo: Math.pow() to bitshift
  const decimalDiv = BigInt(Math.pow(10, decimals));

  const head = qty / decimalDiv;
  const tail = qty % decimalDiv;

  let headFormatted = head.toString();

  // 1000000.0 -> 1'000'000.0
  if (insertQuotes) {
    headFormatted = headFormatted.replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, "'");
  }

  // 1,000.0 -> 1,000
  if (tail === BigInt(0)) {
    return headFormatted;
  }

  // 1'000.10 -> 1'000.00000010
  const tailFormatted = tail.toString().padStart(decimals, "0");

  // 1'000.00012300 -> 1'000.000123
  let tailPadded: string = tailFormatted;
  if (!padTail) {
    while (tailPadded.charAt(tailPadded.length - 1) === "0") {
      tailPadded = tailPadded.slice(0, -1);
    }
  }

  return `${headFormatted}.${tailPadded}`;
}

export function strToTokens(str: string, decimals: number): bigint {
  // 1'000.123 -> 1'000 & 123
  let [head, tail] = str.split(".") as [string, string | undefined];
  // 1'000 -> 1000
  head = head.replaceAll("'", "");

  // todo: Math.pow() to bitshift
  const decimalMul = BigInt(Math.pow(10, decimals));

  if (!tail) {
    return BigInt(head) * decimalMul;
  }

  // 00001000 -> 1000
  let i = 0;
  while (tail.charAt(0) === "0") {
    tail = tail.slice(1, tail.length);
    i++;
  }

  if (tail === "") {
    return BigInt(head) * decimalMul;
  }

  if (tail.length > decimals) {
    throw `Too many decimal digits (max ${decimals})`;
  }

  // 123 -> 12300000
  tail = tail.padEnd(decimals - i, "0");

  return BigInt(head) * decimalMul + BigInt(tail);
}

export interface IAssetMetadata {
  name: string;
  symbol: string;
  decimals: number;
  fee: bigint;
  logoSrc?: string;
}

export async function getAssetMetadata(
  ledger: IcrcLedgerCanister,
  certified: boolean = false,
): Promise<IAssetMetadata> {
  const metadata = await ledger.metadata({ certified });

  const name = (metadata.find((it) => it[0] === IcrcMetadataResponseEntries.NAME)![1] as { Text: string }).Text;
  const symbol = (metadata.find((it) => it[0] === IcrcMetadataResponseEntries.SYMBOL)![1] as { Text: string }).Text;
  const fee = (metadata.find((it) => it[0] === IcrcMetadataResponseEntries.FEE)![1] as { Nat: bigint }).Nat;
  const decimals = (metadata.find((it) => it[0] === IcrcMetadataResponseEntries.DECIMALS)![1] as { Nat: bigint }).Nat;

  let logoEntry = metadata.find((it) => it[0] === IcrcMetadataResponseEntries.LOGO);
  let logo: string | undefined = undefined;

  if (logoEntry) {
    logo = (logoEntry![1] as { Text: string }).Text;
    // base64 decode svg, so it could be xss-purified, then encode back
    if (logo.includes("image/svg")) {
      if (logo.includes("base64")) {
        let [prefix, body] = logo.split(";base64,");
        body = btoa(D.sanitize(atob(body)));
        logo = `${prefix};base64,${body}`;
      } else {
        let [prefix, body] = logo.split(",");
        body = D.sanitize(body);
        logo = `${prefix},${body}`;
      }
    }
  }

  if (typeof fee !== "bigint" || typeof decimals !== "bigint") {
    err(ErrorCode.ICRC1_ERROR, "Invalid metadata");
  }

  return {
    name: D.sanitize(name),
    symbol: D.sanitize(symbol),
    fee,
    decimals: Number(decimals),
    logoSrc: logo ? D.sanitize(logo) : defaultLogo(ledger.canisterId.toText()),
  };
}

export function defaultLogo(assetId: string): string | undefined {
  return PRE_LISTED_TOKENS[assetId]?.logoSrc;
}

export function getClassName(comp: { class: (props: JSX.HTMLAttributes<any>) => string }): string {
  return comp.class({});
}

export function truncateStr(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 1) + "..." : str;
}

export function createPaymentLink(
  kind: "t" | "d",
  assetId: string,
  recipientPrincipal: string,
  amount?: bigint,
  recipientSubaccount?: string,
  memo?: string,
): URL {
  const baseUrl = new URL("pay", import.meta.env.VITE_MSQ_SNAP_SITE_ORIGIN);
  const params = baseUrl.searchParams;

  params.append("kind", kind);
  params.append("canister-id", assetId);
  params.append("to-principal", recipientPrincipal);

  if (recipientSubaccount) {
    params.append("to-subaccount", recipientSubaccount);
  }

  if (amount) {
    params.append("amount", amount.toString());
  }

  if (memo) {
    params.append("memo", memo);
  }

  return baseUrl;
}

// ---------- SECURITY RELATED STUFF ------------

export function eventHandler<E extends Event>(fn: (e: E) => void | Promise<void>) {
  return (e: E) => {
    if (!e.isTrusted) {
      e.preventDefault();
      e.stopImmediatePropagation();

      err(ErrorCode.SECURITY_VIOLATION, "No automation allowed!");
    }

    Promise.resolve(fn(e)).catch((e) => err(ErrorCode.UNKOWN, debugStringify(e)));
  };
}

export function makeIcrc1Salt(assetId: string, accountId: TAccountId): Uint8Array {
  return strToBytes(`\xacicrc1\n${assetId}\n${accountId}`);
}

export const SHOULD_BE_FLASK = true;
