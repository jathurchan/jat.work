export default function Page() {
  return (
    <section className="mx-auto max-w-3xl px-4 md:px-6 py-14 space-y-14">
      {/* Intro */}
      <div className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
          Hello! I’m <span className="decoration-2 bg-gradient-to-r from-sky-500 via-teal-400 to-indigo-500 bg-clip-text text-transparent">Jathurchan Selvakumar</span>
          <span className="text-zinc-500"> (Jat / Jett)</span>
        </h1>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          Software engineer focused on <strong>distributed systems</strong>, <strong>databases</strong>, and 
          <strong> applied ML for retrieval</strong>. I build fault-tolerant and data-driven systems that stay reliable under scale.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            href="/resumes/jat-2025-10-08.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Résumé
          </a>
          <a
            href="https://github.com/jathurchan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/jathurchan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            LinkedIn
          </a>
        </div>
      </div>

      {/* Current Focus */}
      <section className="space-y-3">
        <h2 id="focusing" className="text-xl font-semibold tracking-tight">Current Focus</h2>
        <article className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
          <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
            <h3 className="font-semibold text-2xl">
              Aegis – Policy-Aware RAG Chatbot
            </h3>
            <time className="text-xs text-zinc-500">In Progress</time>
          </header>
          <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Building a lightweight <strong>retrieval-augmented chatbot</strong> that
            <strong> classifies</strong>, <strong>grounds</strong>, and <strong>flags</strong> policy-relevant content
            with <strong>transparent, citation-based</strong> responses.
          </p>
          <div className="mt-4">
            <a
              href="https://github.com/jathurchan/aegis"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              View on GitHub
            </a>
          </div>
        </article>
      </section>

      {/* Experience */}
      <section aria-labelledby="experience-heading" className="space-y-5">
        <h2 id="experience-heading" className="text-xl font-semibold tracking-tight">Selected Work</h2>

        <div className="grid gap-6 sm:grid-cols-2 items-stretch">
          {/* RaftLock */}
          <article className="h-full rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col min-h-[230px] md:min-h-[250px] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
            <header className="flex items-baseline justify-between">
              <h3 className="font-semibold text-lg">RaftLock</h3>
              <time className="text-xs text-zinc-500">2025–Present</time>
            </header>
            <p className="mt-auto pt-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Built fault-tolerant, distributed lock service in Go, implementing <strong>Raft consensus algorithm</strong> from scratch to ensure high availability and data consistency.
            </p>
          </article>

          {/* Amazon */}
          <article className="h-full rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col min-h-[230px] md:min-h-[250px] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
            <header className="flex items-baseline justify-between">
              <h3 className="font-semibold text-lg">Amazon</h3>
              <time className="text-xs text-zinc-500">2024</time>
            </header>
            <p className="mt-auto pt-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Successfully migrated <strong>5 backend services</strong> to CloudAuth, executing safe, staged rollouts and ensuring business continuity by validating rollback plans.
            </p>
          </article>

          {/* Withings */}
          <article className="h-full rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col min-h-[230px] md:min-h-[250px] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
            <header className="flex items-baseline justify-between">
              <h3 className="font-semibold text-lg">Withings</h3>
              <time className="text-xs text-zinc-500">2023–2024</time>
            </header>
            <p className="mt-auto pt-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Built e2e pipeline for AI-powered health insights, serving <strong>6M+ users</strong>. Led cross-team API redesign improving maintainability and scalability.
            </p>
          </article>

          {/* AWS DynamoDB */}
          <article className="h-full rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col min-h-[230px] md:min-h-[250px] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
            <header className="flex items-baseline justify-between">
              <h3 className="font-semibold text-lg">AWS</h3>
              <time className="text-xs text-zinc-500">2022–2023</time>
            </header>
            <p className="mt-auto pt-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Built observability system cutting <strong>false alerts by 99%</strong> for DynamoDB (billions of req/s).
              Improved new Rust client reducing <strong>p99 latency by 28%</strong>.
            </p>
          </article>
        </div>
      </section>

      {/* Certifications / Focus */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Applied ML</h2>
        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          I am deepening my specialization in <strong>applied ML</strong> and <strong>information retrieval</strong>.
          I am certified in <em>Deep Learning</em> (2022), <em>Generative AI with LLMs</em> (2023), and <em>Retrieval-Augmented Generation (RAG)</em> (2025).
        </p>
      </section>

      {/* Closing line */}
      <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">
        I design, build, and maintain systems that are not only scalable but also resilient and performant. My goal is to create software that endures.
      </p>
    </section>
  )
}
