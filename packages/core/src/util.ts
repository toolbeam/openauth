import { Context } from "hono";

export type Prettify<T> = {
  [K in keyof T]: T[K];
};

export function getRelativeUrl(ctx: Context, path: string) {
  const result = new URL(path, ctx.req.url);
  result.host = ctx.req.header("x-forwarded-host") || result.host;
  return result.toString();
}

const twoPartTlds = [
  "co.uk",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.za",
  "co.in",
  "com.au",
  "com.br",
  "com.cn",
  "com.mx",
  "com.tw",
  "net.au",
  "org.uk",
  "ne.jp",
  "ac.uk",
  "gov.uk",
  "edu.au",
  "gov.au",
];

export function isDomainMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const partsA = a.split(".");
  const partsB = b.split(".");
  const hasTwoPartTld = twoPartTlds.some(
    (tld) => a.endsWith("." + tld) || b.endsWith("." + tld),
  );
  const numParts = hasTwoPartTld ? -3 : -2;
  const min = Math.min(partsA.length, partsB.length, numParts);
  const tailA = partsA.slice(min).join(".");
  const tailB = partsB.slice(min).join(".");
  return tailA === tailB;
}
