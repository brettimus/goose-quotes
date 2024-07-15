import { Hono } from 'hono';
import { createHonoMiddleware } from '@fiberplane/hono';
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

// Add middleware to power local development studio
//
app.use(createHonoMiddleware(app));

/**
 * Home page
 * 
 * If `shouldHonk` query parameter is present, then print "Honk honk!"
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
 * 
 * Only requires a `name` parameter in the request body
 */
app.post('/api/geese', async (c) => {
  const sql = neon(c.env.DATABASE_URL)
  const db = drizzle(sql);

  const { name } = await c.req.json()
  const description = `A person named ${name} who talks like a Goose`

  const created = await db.insert(geese).values({ name, description }).returning({
    id: geese.id,
    name: geese.name,
    description: geese.description
  });

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

  console.debug("Generating quotes for ", gooseName);

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

/**
 * Update a Goose by id
 */
app.patch('/api/geese/:id', async (c) => {
  const sql = neon(c.env.DATABASE_URL)
  const db = drizzle(sql);

  const id = c.req.param('id');
  const { name } = await c.req.json()

  const goose = (await db.update(geese).set({ name }).where(eq(geese.id, +id)).returning())?.[0];

  if (!goose) {
    return c.json({ message: 'Goose not found' }, 404);
  }

  return c.json(goose);
});

/**
 * Api route to test getting a header
 */
app.get('/api/goose-headers', async (c) => {
  const goose = c.req.header('x-goose-id');
  return c.text(`${goose}`);
});

/**
 * Api route to test getting a header
 */
app.get('/api/long-response', async (c) => {
  const response = Array.from({ length: 200 }).fill('hi').join("\n")
  return c.text(response);
});

/**
 * Api route to test getting a header
 */
app.get('/api/long-log', async (c) => {
  const toLog = Array.from({ length: 200 }).fill('hi').join("\n")
  console.log(toLog);
  return c.text("Long logs - check them out");
});

/**
 * Api route to test getting a header
 */
app.get('/api/test-many-headers', async (c) => {
  
  Array.from({ length: 200 }).fill('honk').forEach((value, index) => {
    c.res.headers.set(`x-goose-header-${index}`, `${value}-${index}`)
  })
  console.log('hiiii', 'there', { object: 'with stuff', an: { nested: 123 } })
  return c.text("Honk honk check my headers out");
});

/**
 * Api route to test getting a header
 */
app.get('/api/many-headers', async (c) => {
  Array.from({ length: 200 }).fill('honk').forEach((value, index) => {
    c.res.headers.set(`x-goose-header-${index}`, `${value}-${index}`)
  })
  console.log('hiiii', 'there', { object: 'with stuff', an: { nested: 123 } })
  return c.text("Honk honk check my headers out");
});


// app.get("/no-db", (c) => {
//   const db = process.env.DATABASE_URL
//   return c.text("No database connection");
// })

// /**
//  * Route for testing a POST of a non-object body
//  */
// app.post('/api/geese/echo/html', async (c) => {
//   const body = await c.req.json();
//   return c.html(`<div>${body}</div>`);
// });

export default app

function trimPrompt(prompt: string) {
  return prompt
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
}
