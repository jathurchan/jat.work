---
title: 'RaftLock: a distributed lock that survives crashes'
pubDate: 2026-06-22
tags: ['systems']
blurb: Why I built a Raft-based distributed lock from scratch in Go — and how its five layers fit together.
---

I kept hitting the same wall while reading *Designing Data-Intensive Applications*. I could follow the words — quorums, leader election, linearizability — and nod along. But I didn't *believe* them yet. There's a particular kind of understanding you only get by building the thing and watching it survive something that should have broken it.

So I built RaftLock: a distributed lock service that keeps working when machines die. Five nodes, and you can kill two of them while a client is mid-request — the cluster elects a new leader, replays its log, and the lock you were holding is still yours when you reconnect. No split brain. No lost writes. You can [break it yourself in the live demo](/#featured).

This post is the map. It's the story of why I built it and a tour of how the pieces fit. Each layer gets its own deep dive — I'll link them as we go.

## The one-sentence version

A distributed lock has to answer one deceptively hard question: *who holds the lock right now?* — and every node has to agree on the answer, even when the network is splitting nodes apart and machines are crashing mid-operation.

You can't solve that with a clever data structure. You need consensus. RaftLock implements the [Raft consensus algorithm](https://raft.github.io/) from first principles to keep a replicated log consistent across the cluster, then runs a lock state machine on top of that log. Consensus guarantees everyone applies the same commands in the same order; the state machine turns that ordered stream into mutual exclusion.

## Five layers, clean seams

The thing I'm proudest of isn't any single algorithm — it's the seams between the layers. Each one does exactly one job and talks to its neighbours through a narrow interface, which is the only reason a system this stateful is testable at all.

- **`raft`** — the consensus engine. Leader election, log replication, and the safety guarantees that make the rest possible. The distributed brain. → [deep dive](/blog/raftlock-the-consensus-engine)
- **`storage`** — durable persistence. A purpose-built append-only log and crash-safe state files, so a node that dies mid-write comes back to a valid state. → [deep dive](/blog/raftlock-a-storage-engine-built-for-one-job)
- **`lock`** — the state machine. The actual business logic: who holds what, who's waiting, when it expires. Raft hands it committed commands; it enforces the lock semantics. → [deep dive](/blog/raftlock-the-state-machine-behind-the-lock)
- **`server`** — the integration layer. It binds the four other packages together and bridges Raft's *asynchronous* replication to the *synchronous* gRPC call a client is blocking on. → [deep dive](/blog/raftlock-the-integration-layer)
- **`client`** — the smart SDK. Leader discovery, retries, and lifecycle helpers, so an application developer never has to think about which node is the leader. → [deep dive](/blog/raftlock-a-smart-client-for-a-hard-problem)

A request flows down through `client → server → raft → storage`, gets committed across a majority of nodes, then flows back up through `raft → lock → server → client`. Consensus in the middle; everything else is the scaffolding that makes consensus usable.

## How a lock acquisition actually travels

It's worth tracing one request end to end, because it's where all five layers show up at once:

1. A client calls `Acquire`. The **client** SDK routes it to whichever node it thinks is the leader.
2. The **server** validates it, rate-limits it, confirms it really is the leader (or redirects you if not), and proposes the command to Raft.
3. The **raft** engine replicates the command to a majority of followers. Each node durably appends it via **storage**. Once a majority has it on disk, it's *committed* — and committed in Raft means permanent.
4. Raft hands the committed command to the **lock** state machine, which records that you now own the lock and returns a fencing token.
5. The **server** matches that result back to your still-blocking gRPC call and answers you.

Every one of those steps has a failure mode I had to design for — a leader dying between steps 2 and 3, a follower's disk failing in step 3, your client timing out during step 5. The deep dives are, mostly, the stories of those failure modes.

## The principles I kept coming back to

Three ideas shaped almost every decision, and they're worth stating up front because they explain the trade-offs in every other post:

**Correctness over cleverness.** The core code maps directly onto the Raft paper — `Follower`, `Candidate`, `Leader`, the same variable names, the same invariants. I only reached for an optimization when I could add it without obscuring that mapping. For a consensus system, a clever bug is worse than a slow correct path.

**Single-threaded where it counts.** The heart of Raft is one event loop processing messages off channels, one at a time, deterministically. No locks guarding the core state, which means an entire category of concurrency bugs simply can't exist there. I lean on Go's channels (CSP) instead of shared-memory mutexes for the consensus logic. It made the hardest part of the system the most predictable part.

**You can't fix what you can't see.** I built this assuming it *would* fail in production, because distributed systems do. Every state transition, every RPC, every commit is instrumented with structured logs and Prometheus metrics. The first time a partition test reproduced a real bug and the logs told me exactly which node voted for whom and when, I understood why observability is a feature, not an afterthought.

## How I convinced myself it works

A consensus algorithm is only as trustworthy as its tests, and "it passed once" means nothing here. The piece I'm proudest of is a deterministic simulation framework: a virtual clock and a fake network that let me spin up a whole cluster inside a single test process and then be cruel to it — drop messages, reorder them, partition the cluster into arbitrary groups, crash and restart nodes at random moments, inject disk failures.

After each chaotic run, the harness checks Raft's safety invariants: no two leaders in the same term, no committed entry ever overwritten. Thousands of randomized scenarios, all reproducible from a seed. It's Jepsen-style testing in miniature, and it's the reason I trust the thing. I get into how it's wired up in the [raft deep dive](/blog/raftlock-the-consensus-engine).

## Where to go next

If you want the theory made concrete, start with the [consensus engine](/blog/raftlock-the-consensus-engine) — it's the heart of the whole project. If you care more about the unglamorous work of not losing data when the power cuts out, the [storage engine](/blog/raftlock-a-storage-engine-built-for-one-job) is the one for you.

RaftLock didn't teach me distributed systems by reading about them. It taught me by letting me kill a node and watch the cluster refuse to lose my lock. That's the takeaway I'd want you to leave with: the gap between understanding a paper and trusting an implementation is exactly the width of the tests you're willing to write. The code is [on GitHub](https://github.com/jathurchan/raftlock).
