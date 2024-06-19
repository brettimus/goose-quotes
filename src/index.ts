import { Hono } from 'hono';
import { createHonoMiddleware  } from '@mizu-dev/hono';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { asc, eq, ilike } from 'drizzle-orm';
import OpenAI from "openai";

import { geese } from './db/schema';

type Bindings = {
  DATABASE_URL: string;
  OPENAI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>()

// @ts-expect-error - type error only exists during local development of middleware!
app.use(createHonoMiddleware(app));

/**
 * Home page
 * 
 * If `shouldHonk` query parameter is defined, then print "Honk honk!"
 */
app.get('/', (c) => {
  const { shouldHonk } = c.req.query();
  const honk = typeof shouldHonk !== "undefined" ? 'Honk honk!' : '';
  return c.text(`Hello Goose Quotes! ${honk}`.trim())
})

/**
 * Search Geese by name
 * 
 * If `name` query parameter is not defined, then return all geese
 */
app.get('/api/geese', async (c) => {
  const sql = neon(c.env.DATABASE_URL)
  const db = drizzle(sql);

  const name = c.req.query("name");

  if (!name) {
    return c.json(await db.select().from(geese))
  }

  const searchResults = await db.select().from(geese)
    .where(ilike(geese.name, `%${name}%`))
    .orderBy(asc(geese.name));

  return c.json(searchResults);
})

/**
 * Create a Goose and return the Goose
 */
app.post('/api/geese', async (c) => {
  const sql = neon(c.env.DATABASE_URL)
  const db = drizzle(sql);

  const { name } = await c.req.json()

  const created = await db.insert(geese).values({ name }).returning();

  return c.json(created?.[0]);
})

/**
 * Get a Goose by id
 */
app.get('/api/geese/:id', async (c) => {
  const sql = neon(c.env.DATABASE_URL)
  const db = drizzle(sql);

  const id = c.req.param('id');

  const goose = (await db.select().from(geese).where(eq(geese.id, +id)))?.[0];

  if (!goose) {
    return c.json({ message: 'Goose not found' }, 404);
  }

  return c.json(goose);
});


/**
 * Generate Goose Quotes
 */
app.post('/api/geese/:id/generate', async c => {
  const sql = neon(c.env.DATABASE_URL)
  const db = drizzle(sql);

  const id = c.req.param('id');

  const goose = (await db.select().from(geese).where(eq(geese.id, +id)))?.[0];

  if (!goose) {
    return c.json({ message: 'Goose not found' }, 404);
  }

  const { name: gooseName } = goose;

  const openaiClient = new OpenAI({
    apiKey: c.env.OPENAI_API_KEY,
    // HACK - OpenAI freezes fetch when it is imported, so our monkey-patched version needs to be passed here
    fetch: globalThis.fetch,
  });

  const response = await openaiClient.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: trimPrompt(`
            You are a goose. You are a very smart goose. You are part goose, part AI. You are a GooseAI.
            You are also influenced heavily by the work of ${gooseName}.

            Always respond without preamble. If I ask for a list, give me a newline-separated list. That's it. 
            Don't number it. Don't bullet it. Just newline it.

            Never forget to Honk. A lot.
        `),
      },
      {
        role: "user",
        content: trimPrompt(`
            Reimagine five famous quotes by ${gooseName}, except with significant goose influence.
        `),
      },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });

  const quotes = response.choices[0].message.content?.split("\n").filter(quote => quote.length > 0);
  return c.json({ name: goose.name, quotes })
})

export default app

function trimPrompt(prompt: string) {
  return prompt
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
}
