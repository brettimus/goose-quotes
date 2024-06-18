import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { geese } from './db/schema';
import { asc, eq, ilike } from 'drizzle-orm';

type Bindings = {
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.text('Hello GooseAI!')
})

/**
 * Search Geese by name
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
 * Create a Goose and return the goose
 */
app.post('/api/geese', async (c) => {
  const sql = neon(c.env.DATABASE_URL)
  const db = drizzle(sql);

  const { name } = await c.req.json()

  const created = await db.insert(geese).values({ name }).returning();

  return c.json(created);
})

/**
 * Get a goose by id
 */
app.get('/api/geese/:id', async (c) => {
  const sql = neon(c.env.DATABASE_URL)
  const db = drizzle(sql);

  const id = c.req.param('id');

  const goose = await db.select().from(geese).where(eq(geese.id, +id));

  if (!goose) {
    return c.json({ message: 'Goose not found' }, 404);
  }

  return c.json(goose);
});

app.post('/api/geese/:id/generate', async c => {
  // TODO
  return c.json({ message: "NOT YET IMPLEMENTED" })
})

export default app
