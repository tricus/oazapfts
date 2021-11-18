import * as qs from "./query";
import { joinUrl, stripUndefined } from "./util";
import { ok, SuccessResponse } from "../";

import { bytes as k6_bytes } from "k6";
import {
  Params as k6_Params,
  RequestBody as k6_RequestBody,
  request as k6_request,
  RefinedResponse,
  ResponseType,
} from "k6/http";

export type RequestOpts = {
  baseUrl?: string;
  method?: string;
  fetch?: typeof k6_request;
  retries?: number;
} & k6_Params;

type FetchRequestOpts = RequestOpts & {
  body?: k6_RequestBody;
};

type JsonRequestOpts = RequestOpts & {
  body?: object;
};

type MultipartRequestOpts = RequestOpts & {
  body?: Record<string, string | Blob | undefined | any>;
};

export type ApiResponse = { status: number; data?: any; tries?: number };

interface runtimeType {
  ok<T extends ApiResponse>(someresult: T): SuccessResponse<T>;
  fetchText(
    url: string,
    req?: FetchRequestOpts | undefined
  ): {
    status: number;
    contentType: string;
    data: string | number[] | null | undefined;
  };
  fetchJson<T extends ApiResponse>(url: string, req?: FetchRequestOpts): T;
  fetchBlob<T extends ApiResponse>(url: string, req?: FetchRequestOpts): T;
  json(opts: JsonRequestOpts): RequestOpts;
  form(opts: JsonRequestOpts): RequestOpts;
  multipart(opts: MultipartRequestOpts): MultipartRequestOpts;
}

export function runtime(defaults: RequestOpts): runtimeType {
  function fetchText(url: string, req?: FetchRequestOpts) {
    const { response, tries } = doFetch(url, req);
    let data;
    try {
      data = response.body;
    } catch (err) {}

    return {
      status: response.status,
      contentType: response.headers["Content-Type"],
      data,
      tries,
    };
  }

  function fetchJson<T extends ApiResponse>(
    url: string,
    req: FetchRequestOpts = {}
  ) {
    //const { status, contentType, data } = fetchText(url, {
    const { status, contentType, data, tries } = fetchText(url, {
      ...req,
      headers: {
        ...req.headers,
        Accept: "application/json",
      },
    });

    const jsonTypes = ["application/json", "application/hal+json"];
    const isJson = contentType
      ? jsonTypes.some((mimeType) => contentType.includes(mimeType))
      : false;

    return isJson
      ? ({ status, data: data ? JSON.parse(data as string) : null, tries } as T)
      : ({ status, data, tries } as T);
  }

  function fetchBlob<T extends ApiResponse>(
    url: string,
    req: FetchRequestOpts = {}
  ) {
    const { response, tries } = doFetch(url, req);
    let data;
    try {
      data = response.body as k6_bytes; // probably have to convert bytes to object here
    } catch (err) {}
    return { status: response.status, data, tries } as T;
  }

  function doFetch(url: string, req: FetchRequestOpts = {}) {
    const {
      baseUrl,
      method,
      headers,
      body,
      fetch: customFetch,
      retries = 0, // default = 0 retries
      ...params
    } = { ...defaults, ...req };

    const href = joinUrl(baseUrl, url);

    const maxTries = Math.max(retries, 0) + 1;
    let tries = 0;
    let response: RefinedResponse<ResponseType>;
    do {
      response = (customFetch || k6_request)(method ?? "GET", href, body, {
        ...params,
        headers: stripUndefined({ ...defaults.headers, ...headers }),
      });
      tries++;
      if (response.status >= 200 && response.status < 300) break;
    } while (tries < maxTries);
    return { response, tries };
  }

  return {
    ok,
    fetchText,
    fetchJson,
    fetchBlob,

    json({ body, headers, ...req }: JsonRequestOpts) {
      return {
        ...req,
        ...(body && { body: JSON.stringify(body) }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      };
    },

    form({ body, headers, ...req }: JsonRequestOpts) {
      return {
        ...req,
        ...(body && { body: qs.form(body) }),
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };
    },

    multipart({ body, ...req }: MultipartRequestOpts) {
      if (!body) return req;
      return {
        ...req,
        body: body,
      };
    },
  };
}
