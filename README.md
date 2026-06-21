# Hi, I'm Jat 👋

I'm **Jathurchan Selvakumar**, a Software Engineer and Site Reliability Engineer (SRE) at Google, based in Dublin. I build reliable infrastructure and enjoy solving hard scaling problems.

My work and interests primarily revolve around three pillars:

- ☁️ **Cloud Computing:** Building and operating infrastructure at planetary scale.
- ⚙️ **Distributed Systems:** Designing systems that survive failure and scale gracefully.
- 🧠 **AI & ML:** Keeping up with the rapid advancements in Generative AI, LLMs, and RAG architectures.

## Featured Project: RaftLock 🔒

[RaftLock](https://github.com/jathurchan/raftlock) is where I go deepest into distributed systems. It's a distributed lock that survives crashes — built using the Raft consensus algorithm from scratch in Go.

- Survives 2 of 5 node crashes
- Raft consensus built from first principles
- 82% test coverage
- Powered by Go & gRPC

You can check out an interactive, live simulation of the cluster directly on my website!

## My Journey

- **Google** (2026 — Present): Software Engineer · SRE, Dublin
- **Amazon** (2024): Software Dev Engineer, Luxembourg
- **Withings** (2023 — 2024): iOS Engineer, Paris
- **Amazon Web Services** (2022, 2023): SDE Intern, Dublin

## About This Repository

This repository holds the source code for my personal website and portfolio. It was built from scratch as a static [Astro](https://astro.build) project.

Beyond standard static generation, it features a custom interactive `<canvas>` rendering of a 5-node Raft cluster, dynamic theme switching, and a content pipeline managed via YAML (`src/config/site.yaml`) and MDX collections.

### Developing locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output -> dist/
npm run preview  # serve the production build
```

**Scaffolding a new blog post:**

```bash
npm run new:post -- "What I learned shipping on call"
```

## Get in Touch

- 📧 Email: [hello@jat.work](mailto:hello@jat.work)
- 💼 LinkedIn: [in/jathurchan](https://www.linkedin.com/in/jathurchan)
- 🐙 GitHub: [@jathurchan](https://github.com/jathurchan)
