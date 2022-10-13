import { useMatches } from "@remix-run/react";
import { useMemo } from "react";
import { useActionData, useLoaderData } from '@remix-run/react'
import * as _superjson from 'superjson'
import type { User } from "~/models/user.server";
import { Decimal } from "decimal.js";

const DEFAULT_REDIRECT = "/";

/**
 * This should be used any time the redirect path is user-provided
 * (Like the query string on our login/signup pages). This avoids
 * open-redirect vulnerabilities.
 * @param {string} to The redirect destination
 * @param {string} defaultRedirect The redirect to use if the to is unsafe.
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect: string = DEFAULT_REDIRECT
) {
  if (!to || typeof to !== "string") {
    return defaultRedirect;
  }

  if (!to.startsWith("/") || to.startsWith("//")) {
    return defaultRedirect;
  }

  return to;
}

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON|undefined} The router data or undefined if not found
 */
export function useMatchesData(
  id: string
): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(
    () => matchingRoutes.find((route) => route.id === id),
    [matchingRoutes, id]
  );
  return route?.data;
}

function isUser(user: any): user is User {
  return user && typeof user === "object" && typeof user.email === "string";
}

export function useOptionalUser(): User | undefined {
  const data = useMatchesData("root");
  if (!data || !isUser(data.user)) {
    return undefined;
  }
  return data.user;
}

export function useUser(): User {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      "No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead."
    );
  }
  return maybeUser;
}

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

export type SuperJsonFunction = <Data extends unknown>(
  data: Data,
  init?: number | ResponseInit,
) => SuperTypedResponse<Data>

export declare type SuperTypedResponse<T extends unknown = unknown> =
  Response & {
    superjson(): Promise<T>
  }

type AppData = any
type DataFunction = (...args: any[]) => unknown // matches any function
type DataOrFunction = AppData | DataFunction

export type UseDataFunctionReturn<T extends DataOrFunction> = T extends (
  ...args: any[]
) => infer Output
  ? Awaited<Output> extends SuperTypedResponse<infer U>
    ? U
    : Awaited<ReturnType<T>>
  : Awaited<T>

export const superjson: SuperJsonFunction = (data, init = {}) => {
  let responseInit = typeof init === 'number' ? { status: init } : init
  let headers = new Headers(responseInit.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8')
  }
  return new Response(_superjson.stringify(data), {
    ...responseInit,
    headers,
  }) as SuperTypedResponse<typeof data>
}

export function useSuperLoaderData<T = AppData>(): UseDataFunctionReturn<T> {
  const data = useLoaderData()
  return _superjson.deserialize(data)
}
export function useSuperActionData<
  T = AppData,
>(): UseDataFunctionReturn<T> | null {
  const data = useActionData()
  return data ? _superjson.deserialize(data) : null
}

export type RedirectFunction = (
  url: string,
  init?: number | ResponseInit,
) => SuperTypedResponse<never>

export const redirect: RedirectFunction = (url, init = 302) => {
  let responseInit = init
  if (typeof responseInit === 'number') {
    responseInit = { status: responseInit }
  } else if (typeof responseInit.status === 'undefined') {
    responseInit.status = 302
  }

  let headers = new Headers(responseInit.headers)
  headers.set('Location', url)

  return new Response(null, {
    ...responseInit,
    headers,
  }) as SuperTypedResponse<never>
}

_superjson.registerCustom<Decimal, number>(
  {
    isApplicable: (v): v is Decimal => Decimal.isDecimal(v),
    serialize: v => v.toNumber(),
    deserialize: v => new Decimal(v),
  },
  'decimal.js'
);