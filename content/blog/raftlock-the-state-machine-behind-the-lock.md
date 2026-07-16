---
title: 'Inside RaftLock: the state machine behind the lock'
pubDate: 2026-06-16
tags: ['systems']
blurb: Heaps for expiration and priority, an LRU read cache, and the snapshot detail that channels can't survive.
---

[Raft](/blog/raftlock-the-consensus-engine) guarantees every node sees the same *log* of commands in the same order. But a log of commands isn't a lock. Something has to *execute* those commands and enforce what "holding a lock" actually means. That something is the `lock` package: RaftLock's state machine, the layer that turns a consensus stream into mutual exclusion.

It implements the business logic:

- **State management**: the in-memory truth of who holds which lock, for how long, and who's waiting.
- **Lifecycle enforcement**: acquisition, renewal, release, and expiration, never violating mutual exclusion.
- **Wait management**: blocked clients held in priority queues, woken the instant a lock frees up.

## Driven deterministically by Raft

The `LockManager` is deliberately *not* in charge of when things happen. Raft is. Everything flows through a single `Apply` method:

1. **Decode**: Raft commits an entry ("Client A acquires Lock X"); `Apply` decodes the command bytes.
2. **Idempotency check**: it compares against `lastAppliedIndex` so the same command never executes twice. This is non-negotiable for replay safety: when a node restarts and Raft replays its log, applying a command a second time would corrupt the state.
3. **Execute**: it switches on the operation (`Acquire`, `Release`, `Renew`, `EnqueueWaiter`) and mutates the state maps.
4. **Respond**: the result goes back to Raft, which routes it to the client.

Because every node runs the same `Apply` over the same ordered log, every node reaches the same state. That's the entire contract.

## Expiring locks without scanning everything

Locks have TTLs, so something has to find and expire them. The naive approach, scanning every lock on a timer, is `O(N)` and gets worse exactly when you have the most locks. I didn't want CPU usage that climbs with load, so I used a **min-heap**, the `expirationHeap`, ordered by `ExpiresAt`:

- finding the next lock to expire is `O(1)` (it's the top of the heap),
- removing it is `O(log N)`,
- a periodic `Tick` checks *only* the top: if the soonest-to-expire lock is still valid, the loop stops immediately.

So with thousands of active locks, the expiration sweep does a constant amount of work per tick unless something's actually expiring. The CPU cost tracks real expirations, not the size of the lock table.

## Fair, preemptable waiting

RaftLock supports blocking acquires, and not as a plain FIFO line. The `waitQueue` is a priority heap:

- **Ranking**: waiters are ordered by `Priority` first (higher wins), then by `Enqueued` time, so ties break FIFO and fairness is preserved within a priority level.
- **Promotion**: when a lock releases or expires, `tryPromoteWaiterLocked` pops the highest-priority waiter and immediately grants ownership, notifying them over a Go channel (`notifyCh`).
- **Cleanup**: a `pendingWaits` map ties each client to its heap index, so cancelling a wait is `O(1)` instead of a linear scan.

Priority plus FIFO-within-priority gives you something that's both fair and expressive: urgent work can jump the queue without starving everyone else.

## An LRU cache for reads

The manager protects its state with a single central `sync.RWMutex`. That's simple and safe, but heavy read traffic (`GetLockInfo`) can contend with writes (`Acquire`/`Release`). So reads get an optional **LRU cache**:

- it stores copies of `LockInfo` objects, and reads check it first,
- it's invalidated precisely: whenever a Raft command modifies a lock, `cache.Invalidate` drops the stale entry.

Because invalidation is driven by the same committed commands that change state, readers almost never see stale data, and the central mutex sees far less contention. It's an optimization that's safe specifically *because* it's wired into the deterministic apply path.

## A tour of the code

Modular by responsibility:

- `lock.go`: the core `LockManager`: the `Apply` loop, the state maps (`locks`, `waiters`), and the central mutex.
- `waiter.go`: the `waitQueue` priority heap and the `waiter` struct with its notification channels.
- `expiration.go`: the `expirationHeap` for `O(1)` access to the next expiring lock.
- `cache.go`: the thread-safe LRU cache.
- `filters.go`: functional options for querying locks (`FilterByOwner`, `FilterExpiringSoon`).

## The snapshot detail I had to think hardest about

Snapshotting lets Raft truncate its log, so the `LockManager` has to serialize its entire state. The `lockSnapshot` struct captures `Locks`, `Waiters`, and `LastAppliedIndex` as JSON. On `RestoreSnapshot`, I rebuild the optimization structures (the `expirationHeap` and the `clientLocks` map) from the flat list of locks.

But here's the catch that took me a while to fully appreciate: **notification channels can't be serialized.** A `notifyCh` is a transient in-memory Go construct, not data. So if a node restarts and restores from a snapshot, any *pending local waits* are reset: the channels they'd be notified on no longer exist. The persisted lock *state* is perfectly consistent; the ephemeral "I'm a client blocked waiting right here" relationship is not, because it never could be. Recognizing which parts of your state are durable data and which are transient runtime wiring is, it turns out, a core skill in building state machines.

## The trade-offs

1. **Complexity for performance.** Heaps for both expiration and waiting add real code complexity (managing heap indices in `waiter.go` and `expiration.go` is fiddly), but they keep the system at `O(log N)` under heavy load instead of degrading to `O(N)`. For the hot path, worth it.
2. **Memory for consistency.** The entire lock state lives in RAM. That makes applying Raft commands extremely fast, but it bounds the maximum number of active locks to available server memory. A deliberate ceiling.
3. **Granular locking.** One `sync.RWMutex` for the manager technically serializes command execution. I mitigated it by keeping critical sections tiny (map updates only) and offloading reads to the cache.

## Closing the loop

This is the layer where everything else pays off. The [storage engine](/blog/raftlock-a-storage-engine-built-for-one-job) makes the log durable, the [consensus engine](/blog/raftlock-the-consensus-engine) makes it agreed-upon and ordered, the [server](/blog/raftlock-the-integration-layer) and [client](/blog/raftlock-a-smart-client-for-a-hard-problem) make it usable. And right here, finally, an ordered stream of bytes becomes the simple promise a developer actually wanted: *you, and only you, hold this lock right now.*

The takeaway from building it: a state machine's hardest job isn't the logic, it's being honest about what is durable data and what is just runtime wiring that has to be rebuilt. Get that boundary right and replay, restart, and snapshot all just work. If you've read this far, go [break the live cluster](/#featured). The code is [on GitHub](https://github.com/jathurchan/raftlock).
