import * as qs from "./query";
import { joinUrl, stripUndefined } from "./util";
import { ok, SuccessResponse } from "../";

import { bytes as k6_bytes } from "k6";
import {
  Params as k6_Params,
  RequestBody as k6_RequestBody,
  request as k6_request,
} from "k6/http";

export type RequestOpts = {
  baseUrl?: string;
  method?: string;
  fetch?: typeof k6_request;
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

export type ApiResponse = { status: number; data?: any };

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
    const res = doFetch(url, req);
    let data;
    try {
      data = res.body;
    } catch (err) {}

    return {
      status: res.status,
      contentType: res.headers["Content-Type"],
      data,
    };
  }

  function fetchJson<T extends ApiResponse>(
    url: string,
    req: FetchRequestOpts = {}
  ) {
    const { status, contentType, data } = fetchText(url, {
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

    if (isJson) {
      return { status, data: data ? JSON.parse(data as string) : null } as T;
    }

    return { status, data } as T;
  }

  function fetchBlob<T extends ApiResponse>(
    url: string,
    req: FetchRequestOpts = {}
  ) {
    const res = doFetch(url, req);
    let data;
    try {
      data = res.body as k6_bytes; // probably have to convert bytes to object here
    } catch (err) {}
    return { status: res.status, data } as T;
  }

  function doFetch(url: string, req: FetchRequestOpts = {}) {
    const {
      baseUrl,
      method,
      headers,
      body,
      fetch: customFetch,
      ...params
    } = { ...defaults, ...req };
    const href = joinUrl(baseUrl, url);

    const res = (customFetch || k6_request)(method ?? "GET", href, body, {
      ...params,
      headers: stripUndefined({ ...defaults.headers, ...headers }),
    });
    return res;
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
