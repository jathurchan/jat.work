// The hero's intro.json window claims this file exists — so it does. A real
// endpoint for anyone curious enough to read the source (or guess the URL):
// the same facts the hero shows, as actual JSON. Prerendered at build time.
import type { APIRoute } from 'astro';
import { intro, profile } from '../lib/site';
import { getPosts } from '../lib/posts';

export const GET: APIRoute = async () => {
  const latest = (await getPosts())[0] ?? null;

  const body = {
    role: intro.role,
    focus: intro.pillars.map((p) => p.label),
    ...(latest && {
      latest: {
        title: latest.data.title,
        url: `https://jat.work/blog/${latest.id}`,
      },
    }),
    ...(intro.details && {
      education: intro.details.education,
      based_in: intro.details.basedIn,
    }),
    contact: profile.email,
    links: {
      github: profile.links.github,
      linkedin: profile.links.linkedin,
    },
  };

  // Pretty-printed on purpose: this file exists to be read by a human.
  return new Response(JSON.stringify(body, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
