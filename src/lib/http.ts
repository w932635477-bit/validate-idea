import * as cheerio from "cheerio";
// ponytail: 用 undici 包自己的 fetch,不用 Node 全局 fetch。
// 只 import {ProxyAgent} from "undici" 会污染全局 fetch,使其带 signal 时抛
// UND_ERR_INVALID_ARG / "invalid onRequestStart method"(undici 包版本与 Node 内置
// undici 冲突)。同源的 undici.fetch 无此问题(signal/dispatcher 版本一致)。
import { ProxyAgent, fetch as undiciFetch, type Dispatcher, type RequestInit, type Response } from "undici";

// 自用工具低频调用,不做商用级 circuit breaker。失败一律走 fetcher 内 catch → ok:false。
const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 中国本地自用:fetcher 直连被墙的源(Bing/Google/Trends)经本地代理出。
// 只作用于本文件的 fetch(=所有 fetcher),不碰 LLM(ai SDK 直连 DeepSeek,本就好用)。
// 部署 Vercel(美国)无 HTTPS_PROXY env → proxyDispatcher 为 undefined → 直连,自动失效。
const PROXY_URL =
  process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
const proxyDispatcher: Dispatcher | undefined = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const opts = {
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": DEFAULT_UA, "accept-language": "zh-CN,zh;q=0.9,en;q=0.8", ...(init.headers ?? {}) },
    } as RequestInit & { dispatcher?: Dispatcher };
    if (proxyDispatcher) opts.dispatcher = proxyDispatcher;
    return await undiciFetch(url, opts);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<T> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

export async function fetchHtml(
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<cheerio.CheerioAPI> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return cheerio.load(await res.text());
}

export function encodeQ(keywords: string[]): string {
  return encodeURIComponent(keywords.join(" "));
}
