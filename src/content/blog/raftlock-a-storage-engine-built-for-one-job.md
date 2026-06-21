---
title: 'Inside RaftLock: a storage engine built for one job'
pubDate: 2026-06-18
tags: ['systems']
blurb: Why I wrote a custom append-only log instead of reaching for RocksDB — and how it survives a crash mid-write.
---

Consensus gets the glory, but it's worthless if the disk lies to you. The [`raft` engine](/blog/raftlock-the-consensus-engine) can guarantee a command is *committed* only if the layer beneath it can guarantee the command is *durable*. That layer is the `storage` package, and it's where I spent more time on crash recovery than on any clever algorithm.

Its job is to safely record two things:

1. **The Raft log** — an append-only sequence of commands in `log.dat`, the full history of replicated operations.
2. **Raft's persistent state** — `CurrentTerm` and `VotedFor` in `state.json`, the metadata Raft needs to stay safe across restarts.

Everything RaftLock claims about consistency ultimately rests on these two files surviving a power cut.

## Why I didn't just use RocksDB

This was the first real "build vs. buy" decision, and I went back and forth on it. RocksDB and BoltDB are excellent, battle-tested, and free. But they're general-purpose key-value stores, and RaftLock's workload isn't general-purpose at all — it's almost entirely **append-only writes and sequential reads**. That's the single access pattern a flat log file is best in the world at.

Bringing in an LSM-tree engine would have meant inheriting page caches, background compaction, and a heavy dependency to serve a workload that needs none of it. By writing a purpose-built log layer instead, I got:

- lower latency and fewer syscalls,
- no surprise compaction pauses,
- total control over durability semantics,
- zero external dependencies.

It's not that RocksDB is wrong — it's that it solves a harder problem than I have. Matching the engine to the access pattern gave me something simpler, faster, and far more predictable.

## Three principles

`FileStorage`, the engine, is built around three ideas:

1. **Simplicity and predictability.** The format and the code are intentionally plain. Access is mostly sequential. Fewer moving parts means fewer ways to be wrong, and a format I can debug by reading the file.
2. **Durability and correctness first.** Every acknowledged write is persisted with `fsync` when `SyncOnAppend` is on. If I told Raft a write landed, it survives power loss. Full stop.
3. **Targeted performance.** Fast appends and `O(log n)` indexed reads, tuned to Raft's real workload — not a benchmark that doesn't resemble production.

## Surviving a crash mid-write

This is the part I'm proudest of, because it's the part that's easy to get subtly, silently wrong. Durability comes from three layered safeguards:

**Synchronous writes.** `fsync()` ensures each acknowledged write actually reaches the physical disk, not just the OS page cache.

**Atomic metadata writes.** Metadata never gets updated in place. I write to a temp file and then `rename()` it over the target (`*.tmp → *.json`). On every filesystem I care about, that rename is atomic — so a crash leaves you with either the complete old file or the complete new one, never a half-written mess.

**Crash markers.** Before a multi-step operation, I drop a marker file (`recovery.marker`, `snapshot.marker`). On restart, the recovery service sees the marker and reconciles or rolls back the incomplete operation. Recovery is *explicit and testable* rather than implicit and opaque — I can simulate a crash at any step and assert the system comes back valid.

The result: the storage layer always recovers to a consistent state, and I can prove it by crashing it on purpose.

## Fast lookups without scanning

A Raft follower being brought up to date needs to find arbitrary log entries quickly. Scanning `log.dat` for every read would be unacceptable, so I keep an in-memory `indexToOffsetMap` — each log index mapped to its byte offset in the file.

- On startup it's rebuilt once by scanning the log.
- During operation, new appends add their offsets incrementally.
- Reads binary-search the map and seek straight to the right byte — `O(log n)`.

It costs RAM, and it's a deliberate trade: I spend memory to buy predictable read latency and deterministic rebuilds. For a fault-tolerant system, predictable beats clever.

## Keeping the log from growing forever

An append-only log grows without bound, so RaftLock periodically **snapshots** — compacting old entries into a single recoverable state:

1. Raft calls `SaveSnapshot` with serialized state.
2. The snapshot data and metadata are written to temp files, then atomically renamed (same pattern as everywhere else).
3. Only after the snapshot is safely persisted does `TruncateLogPrefix` drop the now-redundant old entries — synchronously or asynchronously, depending on config.

Persist first, truncate second. The ordering is the whole game: it means a crash mid-snapshot can never leave you having thrown away entries you hadn't safely captured.

## Catching corruption before Raft sees it

Bad data must never reach the consensus layer. So corruption is detected early and contained:

- log entries carry size and index validation,
- the index builder truncates the log at the first inconsistent record,
- metadata ranges are sanity-checked (`first ≤ last`),
- snapshot markers flag incomplete writes for recovery.

The recovery service orchestrates all of this at startup, so by the time Raft asks for an entry, it's already been vouched for.

## A tour of the code

Organized strictly by responsibility, so each piece is testable in isolation:

- `api.go` — the `Storage` interface RaftLock consumes.
- `storage.go` — `FileStorage`, orchestrating init, recovery, thread-safety, and I/O.
- `writer.go` / `reader.go` / `rewriter.go` — appending, reading, and atomic compaction of the log.
- `index.go` — the in-memory `indexToOffsetMap`.
- `metadata.go` — persisted log metadata (`firstIndex`, `lastIndex`).
- `snapshot.go` — snapshot creation and loading.
- `recovery.go` — automatic crash recovery driven by marker files.
- `locker.go` — concurrency control with timeouts and deadlock prevention.
- `metrics.go` — latency, I/O size, and error instrumentation.

## Thread safety and the metrics that matter

`FileStorage` uses fine-grained locks, each scoped to one concern: `stateMu` guards the state file, `logMu` guards the log and metadata, `snapshotMu` guards snapshots. Each is wrapped in an `rwOperationLocker` that adds context cancellation, slow-operation logging, and timeouts so a stuck operation can't silently deadlock the node.

When `EnableMetrics` is on, the layer exposes exactly the signals I'd want at 3am: append latency (avg and p99 — it gates Raft's commit speed), log and snapshot sizes, operation rates, error counters, and slow-operation counts that point straight at I/O contention. `GetMetricsSummary()` prints it all as a human-readable report.

## The trade-offs, stated plainly

I optimized for predictable safety and recoverability over raw throughput, every time:

- **Durability over throughput** — `fsync` per commit instead of batching. Slower, but every acknowledged entry is on disk, and the crash-recovery tests prove it.
- **Portability over kernel tricks** — no `mmap`, no platform-specific magic, so behaviour is identical on Linux, macOS, and Windows.
- **Memory for speed** — the index map trades RAM for `O(log n)` reads.
- **Explicit recovery over hidden journaling** — marker files and atomic renames make crash recovery something you can read and test, not a black box.
- **Configurable complexity** — async truncation, chunked I/O, and binary serialization are all optional knobs.
- **Binary by default, JSON when debugging** — binary for throughput and footprint; JSON when I need to read state with my eyes.

How did I validate all this? The same way I validate everything in RaftLock: fault injection. Truncated writes, index mismatches, interrupted snapshots, rename failures mid-operation, concurrent readers and writers under contention — every error path (`ErrCorruptedLog`, `ErrCorruptedSnapshot`, `ErrStorageIO`) is deliberately triggered and verified. And every feature flag is toggled independently to confirm behaviour stays deterministic across configurations.

## What's next

A few directions I'm eyeing: **pluggable backends** (a RocksDB option for people who want it), **batched fsync** for high-throughput deployments, **paged index structures** for very large logs, and **CRC32 checksums** for even earlier corruption detection.

The takeaway I keep coming back to: durability isn't a feature you add, it's an ordering discipline you maintain — write, sync, *then* acknowledge; persist, *then* truncate. Get the order right and crash recovery stops being scary. Next up, the layer that ties everything together: [the integration server](/blog/raftlock-the-integration-layer).
