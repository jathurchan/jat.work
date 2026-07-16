---
title: 'Inside RaftLock: the integration layer'
pubDate: 2026-06-14
tags: ['systems']
blurb: Turning asynchronous Raft replication into a synchronous gRPC reply, and the tracker that makes it work.
---

The [consensus engine](/blog/raftlock-the-consensus-engine) and the [lock state machine](/blog/raftlock-the-state-machine-behind-the-lock) are the interesting algorithms. The `server` package is the unglamorous layer that makes them usable together, and it turned out to contain the single trickiest piece of synchronization in the whole project.

It's the central nervous system of a RaftLock node. The `raft` package does consensus, the `lock` package does business logic, and `server` coordinates them. Its responsibilities:

- **Protocol translation**: turn external gRPC/Protobuf requests into internal Raft commands.
- **Lifecycle management**: start and stop the sub-components (storage, Raft, network, lock manager) in the right order.
- **Consistency bridging**: reconcile Raft's *asynchronous* replication with the *synchronous* gRPC call a client is blocking on.
- **Gatekeeping**: rate limiting, concurrency control, and strict validation, all before a request ever touches consensus.

## The life of a request

Every request runs the same pipeline, designed to fail fast and stay consistent:

1. **Interception**: the gRPC `unaryInterceptor` catches the call, starts metrics, and acquires a concurrency slot.
2. **Validation and limiting**: the `RequestValidator` checks integrity (valid TTLs, non-empty IDs); the `RateLimiter` checks load.
3. **Leadership check**: if this node isn't the Raft leader, it returns a `LeaderRedirectError` pointing at the right node.
4. **Proposal**: the request is marshaled into a `types.Command` and proposed to Raft.
5. **The wait**: the handler registers a `PendingProposal` and blocks on a Go channel, waiting for the entry to commit and apply.
6. **Resolution**: once Raft applies the command to the lock manager, the result comes back through the channel, gets formatted into a Protobuf response, and returns to the client.

Step 5 is where it gets interesting.

## The async-to-sync bridge

Raft is fundamentally asynchronous: you *propose* a command, later it *commits*, later still it *applies*. But a gRPC client is sitting there synchronously, waiting for an answer. Closing that gap is the job of the `ProposalTracker`, and it's the most complex synchronization component I wrote.

The mechanism:

- When a command is proposed, I generate a unique `ProposalID` from its term and index.
- I register a `PendingProposal` holding a result channel (`ResultCh`) and the client's context.
- The gRPC handler blocks on that channel.
- In the background, `runApplyMessageProcessor` watches Raft's stream of committed entries. When one applies, it tells the tracker, which matches the log index to the waiting proposal and sends the result back.

Simple to describe. The difficulty is everything that can go wrong while a client is blocked.

## The edge cases are the whole job

A naive version of this hangs forever the first time reality misbehaves. Three cases I had to handle explicitly:

**Snapshot invalidation.** If a follower falls far behind and gets caught up via a snapshot, the log indexes inside that snapshot are skipped rather than applied one by one. So the tracker listens for `HandleSnapshotApplied` and fails any pending proposal whose index is `≤` the snapshot index, returning an error instead of leaving the client hanging on a result that's never coming.

**Client cancellation.** If a client times out or disconnects, its `ClientCancel` path removes the pending entry immediately, so the map doesn't leak even if Raft later commits the entry anyway.

**Zombie cleanup.** A background ticker proactively evicts proposals older than `MaxPendingAge`, so a long partition can't grow the pending map without bound.

Most of the code in this package exists for these unhappy paths, making sure no failure mode leaves a client blocked forever or a map growing without limit.

## Protecting the consensus loop

The Raft loop is single-threaded and precious; a flood of clients can't be allowed to overwhelm it. So there's a layered defense:

1. **Token-bucket rate limiting**: configurable per-second limits reject excess traffic immediately with `ResourceExhausted`.
2. **A concurrency semaphore**: `MaxConcurrentReqs` caps how many handler goroutines run at once, preventing memory blowups during spikes.
3. **Validation**: malformed requests (oversized metadata, bad TTLs) are rejected before they burn any serialization or consensus resources.

There's also a `ConnectionManager`, which might look redundant next to gRPC's own connection handling. It exists because gRPC gives you request-level visibility but not connection-level insight, and in distributed *locking* you often need to know *who's holding a connection open even when they're idle* (a client holding a lock and sleeping). It tracks `ConnectedAt`, `LastActive`, and `RequestCount` per remote address, which is exactly what you want when debugging a stuck lock in production.

## Redirect, don't proxy

When a write lands on a follower, I had a choice: silently forward it to the leader, or tell the client to go talk to the leader itself. I chose explicit redirects.

If `Acquire` hits a follower, the server checks its Raft state and, if it knows the leader, returns a `NewLeaderRedirectError` with the leader's ID and address. I rejected internal proxying because it adds a network hop on every misrouted request, it complicates failure handling (now the follower has to babysit the leader's timeouts), and it hides the cluster topology from the client.

The trade-off: clients have to be "smart" enough to follow a redirect, which is exactly what the [client SDK](/blog/raftlock-a-smart-client-for-a-hard-problem) handles for you. In exchange, the system stays faster and more transparent about where work actually happens.

## Construction, observability, and shutdown

A few smaller decisions that paid off:

**A builder, not a struct literal.** `RaftLockServerBuilder` assembles a server with a lot of dependencies (peers, data dir, listeners) and a lot of knobs (timeouts, limits). A struct literal would be easy to get half-wrong; the builder enforces invariants ("NodeID must be set", "Peers must be present") and injects sane defaults, so the server can never start in a partially configured state.

**Decoupled metrics.** A `ServerMetrics` interface keeps instrumentation out of the logic. The interceptor records `IncrGRPCRequest` and `ObserveRequestLatency` automatically; Raft-specific events like `IncrRaftProposal` and `IncrLeaderRedirect` are tracked too. A `runHealthCheckLoop` periodically probes Raft and the lock manager and updates a `HealthStatus` gauge, so a load balancer can pull an unhealthy node *before* it starts failing clients.

**Deterministic shutdown.** Background tasks are managed with explicit `sync.WaitGroup`s. It's more verbose than a framework, but it buys a guaranteed shutdown order: stop gRPC → drain in-flight requests → stop Raft → close storage. For thread safety on the hot path, status flags like `isLeader` use `atomic.Value`/`atomic.Bool` to dodge lock contention, while `RWMutex` guards the maps in `ProposalTracker` and `ConnectionManager`, and channels handle signaling and hand-offs.

## The trade-offs

- **Consistency over availability (CP).** The server refuses writes if it can't reach a quorum or isn't the leader. I return errors rather than serve stale data or risk split-brain. For a lock service, a wrong answer is worse than no answer.
- **Strict validation over flexibility.** Hard limits on ID lengths and metadata sizes mean a client can't push a 1MB payload, which keeps the Raft log and snapshotting predictable. Worth it.
- **Manual background management over a library.** More code, but deterministic shutdown ordering, which matters more than brevity here.

## What happens if the server crashes mid-request?

This is the question that proves the whole design, so it's worth answering directly. The client's connection breaks and it retries with backoff. On the server side, it depends on timing:

- If the log entry was **not** committed, it's simply lost: a new leader starts fresh, and the client's retry creates it anew.
- If the entry **was** committed but not yet applied, the new leader replays the log, applies the lock, and state stays consistent. The original client has disconnected, but when it retries, the lock manager's **idempotency** (deduplication by `RequestID`) means it re-attaches to the lock it already holds rather than double-acquiring.

That last point is the quiet hero of the design: because every layer is idempotent and consistent, a crash in the middle of a request is recoverable rather than catastrophic. The takeaway: most of an integration layer's value isn't in the happy path. It's in guaranteeing that *no failure leaves a client hanging or the state wrong*. Next, the layer that makes those redirects and retries invisible: [the client SDK](/blog/raftlock-a-smart-client-for-a-hard-problem).
