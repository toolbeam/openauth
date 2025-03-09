import { createClient } from "@openauthjs/openauth/client"
import { makePersisted } from "@solid-primitives/storage"
import {
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  ParentProps,
  Show,
  untrack,
  useContext,
} from "solid-js"
import { createStore, produce } from "solid-js/store"

interface Storage {
  subjects: Record<
    string,
    {
      id: string
      refresh: string
    }
  >
  current?: string
}

interface Context {
  subjects: Record<string, SubjectInfo>
  current?: SubjectInfo
  switch(id: string): void
  logout(id: string): void
  authorize(): void
}

interface SubjectInfo {
  id: string
  access(): Promise<string>
}

interface AuthContextOpts {
  issuer: string
  clientID: string
}

const context = createContext<Context>()

export function OpenAuthProvider(props: ParentProps<AuthContextOpts>) {
  const client = createClient({
    issuer: props.issuer,
    clientID: props.clientID,
  })
  const [storage, setStorage] = makePersisted(
    createStore<Storage>({
      subjects: {},
    }),
    {
      name: `${props.issuer}.auth`,
    },
  )

  const [init, setInit] = createSignal<boolean>(false)

  onMount(async () => {
    const hash = new URLSearchParams(window.location.search.substring(1))
    const code = hash.get("code")
    const state = hash.get("state")
    if (code && state) {
      const oldState = sessionStorage.getItem("openauth.state")
      const verifier = sessionStorage.getItem("openauth.verifier")
      const redirect = sessionStorage.getItem("openauth.redirect")
      if (redirect && verifier && oldState === state) {
        const result = await client.exchange(code, redirect, verifier)
        if (!result.err) {
          const id = result.tokens.refresh.split(":").slice(0, -1).join(":")
          batch(() => {
            setStorage("subjects", id, {
              id: id,
              refresh: result.tokens.refresh,
            })
            setStorage("current", id)
          })
        }
      }
    }
    setInit(true)
  })

  async function authorize(redirectPath?: string) {
    const redirect = new URL(
      window.location.origin + (redirectPath ?? "/"),
    ).toString()
    const authorize = await client.authorize(redirect, "code", {
      pkce: true,
    })
    sessionStorage.setItem("openauth.state", authorize.challenge.state)
    sessionStorage.setItem("openauth.redirect", redirect)
    if (authorize.challenge.verifier)
      sessionStorage.setItem("openauth.verifier", authorize.challenge.verifier)
    window.location.href = authorize.url
  }

  const accessCache = new Map<string, string>()
  async function access(id: string) {
    const subject = storage.subjects[id]
    const existing = accessCache.get(id)
    const access = await client.refresh(subject.refresh, {
      access: existing,
    })
    if (access.err) {
      ctx().logout(id)
      throw access.err
    }
    if (access.tokens) {
      setStorage("subjects", id, "refresh", access.tokens.refresh)
      accessCache.set(id, access.tokens.access)
    }
    return access.tokens?.access || existing!
  }

  const ctx = createMemo<Context>(() => {
    console.log("recomputing subject context")
    const subjects: Record<string, SubjectInfo> = {}
    for (const [key, value] of Object.entries(storage.subjects)) {
      subjects[key] = {
        get id() {
          return value.id
        },
        async access() {
          return untrack(() => access(key))
        },
      }
    }
    return {
      subjects,
      get current() {
        return subjects[storage.current!]
      },
      switch(id: string) {
        if (!storage.subjects[id]) return
        setStorage("current", id)
      },
      authorize,
      logout(id: string) {
        if (!storage.subjects[id]) return
        setStorage(
          produce((s) => {
            delete s.subjects[id]
            if (s.current === id) s.current = Object.keys(s.subjects)[0]
          }),
        )
      },
    }
  })

  createEffect(() => {
    if (!init()) return
    if (storage.current) return
    const [first] = Object.keys(storage.subjects)
    if (first) {
      setStorage("current", first)
      return
    }
    authorize()
  })

  return (
    <Show when={init()}>
      <context.Provider value={ctx()}>{props.children}</context.Provider>
    </Show>
  )
}

export function useOpenAuth() {
  const result = useContext(context)
  if (!result) throw new Error("no auth context")
  return result
}

