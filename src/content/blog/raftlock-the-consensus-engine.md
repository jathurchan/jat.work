---
title: 'Inside RaftLock: the consensus engine'
pubDate: 2026-06-20
tags: ['systems']
blurb: Leader election, log replication, a single-threaded core, and the simulation framework I used to trust it.
---

This is the heart of [RaftLock](/blog/raftlock-a-distributed-lock-that-survives-crashes) — the `raft` package, the distributed brain that lets five machines behave as one consistent whole. If you only read one of these deep dives, read this one, because everything else in the system is scaffolding around it.

Its job is narrow and absolute: implement the [Raft consensus algorithm](https://raft.github.io/) to manage a replicated log. Three responsibilities fall out of that:

1. **Leader election** — automatically pick a single leader to handle all client writes.
2. **Log replication** — safely copy the leader's sequence of commands to a majority of followers.
3. **Safety** — guarantee that once a command is committed, it survives in every future leader's log and gets applied everywhere in the exact same order.

Without this package, RaftLock is a single-node toy with no protection against failure. With it, it's a system that survives losing two of five nodes.

## Clean seams with the rest of the system

The `raft` package never touches a file or a socket directly. It talks to the rest of RaftLock through three interfaces, which is the entire reason I can test consensus logic in memory:

- **`storage`** — Raft is a *consumer* here. It persists two things it cannot afford to lose across a restart: the log of entries, and its metadata (`CurrentTerm`, `VotedFor`). It calls `AppendLogEntries` and `SaveState`; it never opens a file.
- **`transport`** — abstracts the network. Raft sends `AppendEntries` and `RequestVote` RPCs without caring whether the wire underneath is gRPC, HTTP/2, or an in-memory Go channel in a test.
- **`fsm`** — once an entry is committed, Raft delivers it to the state machine (the [lock server](/blog/raftlock-the-state-machine-behind-the-lock)) through a single `Apply` method. Raft's job ends the moment the command is delivered. It has no idea what the command *does*, and that ignorance is deliberate.

Mock those three and you can run the entire consensus algorithm in a unit test. That decoupling is what made the whole project tractable.

## The concurrency model is the design

This is the decision I think about most. The Raft node runs one central, single-threaded event loop — `run()` — that owns *all* the critical state: current term, commit index, the log, everything.

Every external event arrives as a message on a channel:

- RPCs from peers land on `rpcCh`.
- Client proposals land on `proposalCh`.
- Election and heartbeat timers tick on `tickCh`.

The loop pulls one message at a time, updates its state, and emits any resulting actions. And here's the crucial part: **the loop never blocks on I/O.** When it needs to send an RPC or write to disk, it hands that work off to a goroutine owned by `transport` or `storage` and immediately goes back to processing the next event.

The payoff is that there are **no locks** guarding the core state. None. Deadlocks become impossible in the part of the system where they'd be hardest to debug, and the behaviour is deterministic — the same sequence of messages always produces the same result. That determinism is what makes the simulation framework below possible. I chose Communicating Sequential Processes over shared-memory mutexes, and it turned the scariest code in the project into the most predictable.

## Reads that skip the log

Routing every read through the full Raft log would be correct but painfully slow. So reads get two optimizations for linearizable results:

**ReadIndex (the default, and the safe one).** When a read hits the leader, it: records its current `commitIndex` (the "read index"), sends a round of heartbeats to confirm a quorum still thinks it's the leader, waits for its own state machine to catch up to that index, and only then serves the read from local state. Confirming leadership before answering is what makes it linearizable — no stale reads, even right after a partition heals.

**Lease reads (faster, with a caveat).** The leader assumes its leadership is still valid for a short lease window without re-confirming with a quorum, as long as clocks are reasonably synced. Lower latency, but it trades away a margin of safety during clock drift. It's there when you want it; ReadIndex is what you get by default.

## A tour of the code

The package is laid out to mirror the paper, so a new contributor can find their footing fast:

- `raft.go` — the `Node` struct, the public API (`Propose()`, `Status()`), and the `run()` loop.
- `node.go` — the state-transition logic: `stepLeader()`, `stepCandidate()`, `stepFollower()`.
- `log.go` — an in-memory abstraction over the Raft log: find, append, truncate, before anything reaches `storage`.
- `progress.go` — the `Progress` struct, how the leader tracks each follower's `nextIndex` and `matchIndex`. The engine room of replication.
- `rpc.go` — the message definitions (`AppendEntriesRequest`, `RequestVoteRequest`, and their responses).
- `fsm.go` — the `StateMachine` interface the application implements to receive committed entries.
- `metrics.go` — the Prometheus instrumentation.
- `testing.go` — the multi-node simulator, which is where the real confidence comes from.

## How I learned to trust it

A consensus implementation that "seems to work" is worthless. I validated this in layers:

**Unit tests** for every component — the `log` manager, the `progress` tracker — covering the edge cases that papers wave past.

**Integration tests** using an in-memory `Transport` built on Go channels. That let me stand up a multi-node cluster inside one test process and run real scenarios: elections, proposals, node restarts.

**A deterministic simulation framework** — the part I'm proudest of. It drives a virtual clock and a simulated network, so I can orchestrate and *reproduce* thousands of randomized failure scenarios:

- dropping, delaying, and reordering RPCs,
- partitioning the cluster into arbitrary groups,
- crashing and restarting nodes at random points,
- injecting storage failures.

After every run it checks Raft's safety invariants — two leaders in one term, a committed entry getting overwritten — and fails loudly if any are violated. Every failure is reproducible from its seed, so a bug found at 2am is a bug I can re-run on demand. This Jepsen-style approach is the single biggest reason I'll vouch for the implementation under real-world chaos.

## The trade-offs I made on purpose

- **Clarity over raw throughput.** Single-threaded core, closely aligned with the paper. I might leave some many-core performance on the table; I keep verifiability and maintainability, which for consensus is the right trade.
- **Pipelining for throughput.** The leader pipelines `AppendEntries` — it sends the next batch before the previous reply arrives. Big win on high-latency links, at the cost of managing an in-flight window (`MaxInflightMsgs`).
- **PreVote for stability.** A candidate must first confirm it *could* win before bumping its term and starting a real election. One extra round-trip, but it stops a partitioned node from rejoining and disrupting a healthy cluster with doomed elections. I chose stability over a few milliseconds.
- **Batching for efficiency.** Proposals are batched before replication — better network and disk efficiency, slightly higher per-request latency. Configurable, so operators can tune it to their workload.

## What's next

The core is stable, but there's a clear runway: **learner nodes** that receive the log without voting, so new members can catch up before they can disrupt quorum; a **batched proposal** API for write-heavy workloads; **leadership transfer** for graceful rolling upgrades; and **adaptive flow control** so a fast leader can't drown a slow follower.

The lesson this package taught me: the way to make terrifyingly complex stateful logic manageable is to make it *boring and deterministic*. One event loop, no locks, every input a message on a channel — and suddenly the impossible-to-debug becomes something you can replay from a seed. Next, the layer underneath: [the storage engine](/blog/raftlock-a-storage-engine-built-for-one-job).
