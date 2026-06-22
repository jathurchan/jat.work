---
title: 'Inside RaftLock: a smart client for a hard problem'
pubDate: 2026-06-12
tags: ['systems']
blurb: Leader discovery, retries with jitter, fencing tokens, and auto-renewal — hiding distributed consensus behind a clean SDK.
---

The whole point of RaftLock is that an application developer shouldn't have to think about consensus. The [server](/blog/raftlock-the-integration-layer) returns redirects and transient errors as a matter of course; the `client` package is what absorbs all of that so the developer just calls `Acquire` and gets a lock.

It's not a transport layer — it's a smart SDK. Three jobs:

- **Leader discovery** — automatically route to the current Raft leader and follow redirects transparently.
- **Resiliency** — mask transient network failures and leader elections behind configurable retries with exponential backoff and jitter.
- **State management** — higher-level abstractions (`LockHandle`, `AutoRenewer`) that manage a lock's lifecycle and prevent "zombie" locks.

## Three interfaces, three personas

I split the client into three interfaces, applying the Interface Segregation Principle to match how people actually use it:

- **`RaftLockClient`** — the *data plane*. The core primitives 95% of developers need: `Acquire`, `Release`, `Renew`. Small, focused surface.
- **`AdminClient`** — the *control plane*. Privileged operations: cluster health, status reporting, backoff advice. Kept separate so administrative endpoints don't leak into ordinary application code.
- **`AdvancedClient`** — the *escape hatch*. Low-level primitives like queue manipulation (`EnqueueWaiter`, `CancelWait`) and manual retry-policy injection, for building specialized tooling or debugging.

The split means the common case stays clean while the power-user case stays possible.

## Why `LockHandle` exists

Raw API calls are stateless, which sounds simple until you realize the caller has to track the `LockID`, the `ClientID`, and — crucially — the lock `Version`, the **fencing token** that prevents a stale client from acting on a lock it no longer really holds. Getting fencing wrong is one of the classic distributed-locking bugs, and I didn't want every user to reimplement it.

So `LockHandle` encapsulates that state in one object:

- **Safety** — it stores the version internally and makes sure every `Release` and `Renew` carries the correct fencing token.
- **Concurrency control** — a mutex guards the lock state for thread-safe access.
- **Cleanup** — its `Close` method makes a best-effort release when the handle is discarded, shrinking the window for accidental deadlocks.

It turns "remember to thread the fencing token through every call" into "hold this object," which is the kind of API I want to use myself.

## Surviving the turbulence

Distributed systems are turbulent — leaders fail over, nodes briefly disappear — and the client is built to ride that out via a `RetryPolicy`:

- **Smart retries, not blind ones.** The default policy targets specifically retryable errors: `NO_LEADER`, `NOT_LEADER`, `UNAVAILABLE`. It won't retry something that isn't going to get better.
- **Thundering-herd prevention.** Randomized `JitterFactor` plus exponential `BackoffMultiplier` keep a recovering leader from getting stampeded by every client reconnecting at once.
- **Leader tracking.** The client remembers the leader's address. When a request fails with "not the leader," it redirects subsequent calls automatically — the topology change never reaches the application.

This is the other half of the [redirect-don't-proxy decision](/blog/raftlock-the-integration-layer): the server stays simple by handing back redirects, and the client makes those redirects invisible.

## Locks that don't expire mid-operation

A lock with a TTL is safe but inconvenient: what if your critical section runs longer than the TTL? The `AutoRenewer` solves it as a sidecar to a `LockHandle`:

- **Background refresh** — a goroutine (managed with `sync.WaitGroup`) periodically sends `Renew` requests.
- **Safety checks** — it confirms the lock is still held locally before making a network call, and stops automatically if the lock is lost or the context is canceled.
- **Configurable** — interval and TTL are tunable, so you can balance network chatter against safety margin.

You get the assurance that your critical section won't expire out from under you, at the cost of a background goroutine you no longer control the exact timing of. For long-running work, that's a trade I'll take every time.

## A fluent, hard-to-misuse builder

Construction goes through a `RaftLockClientBuilder`, for the same reason the server uses one — configuration is easy to get half-wrong:

- **Sensible defaults** — production-ready out of the box (30s request timeout, metrics on), so the simplest path works immediately.
- **Progressive complexity** — start with `NewRaftLockClientBuilder(endpoints).Build()`, then chain `WithRetryPolicy`, `WithKeepAlive`, and the rest as needs grow.
- **Validation up front** — endpoints and other invariants are checked *before* the client exists, turning runtime misconfiguration into a clear construction-time error.

## The trade-offs

- **Smart client over dumb client.** I pushed leader-tracking and retry logic into the client instead of forcing every application to handle blips itself. The client's `executeWithRetry` logic is more complex — but the user's code gets dramatically simpler, which is the whole point of an SDK.
- **Safety over teardown latency.** `LockHandle.Close()` makes a synchronous release call (up to `releaseTimeout`). It adds latency at shutdown, but it stops locks from lingering after a graceful exit.
- **Convenience over precision.** `AutoRenewer` hides renewal behind a goroutine. You lose exact control over when each packet goes out; you gain the guarantee your lock won't lapse mid-critical-section.

The thread running through all three: a good SDK *absorbs* complexity rather than *exposing* it. Every bit of cleverness here — fencing tokens, jittered backoff, auto-renewal — exists so the developer's code can stay boring. Next, the layer the client is ultimately talking to: [the lock state machine](/blog/raftlock-the-state-machine-behind-the-lock).
