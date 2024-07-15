import app from './index'

import dotenv from 'dotenv'

// TODO - use `.env.test` instead of the dev vars
// TODO - create a test branch of the database
dotenv.config({ path: '.dev.vars' });
delete process.env.FPX_ENDPOINT

// FIXME - Execute jest in cloudflare worker environment :thinking_face:
polyfillExecutionContext();

const MOCK_ENV = {
  ...process.env,
  FPX_ENDPOINT: null,
}

describe('goose-quotes api ', () => {
  test('GET /', async () => {
    const res = await app.request('http://localhost/')
    expect(res.status).toBe(200)
  })

  test('GET /api/geese', async () => {
    const res = await app.request('http://localhost/api/geese', undefined, MOCK_ENV)
    expect(res.status).toBe(200)
  })
})

function polyfillExecutionContext() {
  class ExecutionContext {
    // @ts-ignore
    constructor(context) {
      this.context = context;
    }

    get context() {
      // @ts-ignore
      return this._context;
    }

    set context(value) {
      // @ts-ignore
      this._context = value;
    }

    // @ts-ignore
    execute(callback) {
      // Mocking an execution within a context
      const result = callback(this.context);
      return result;
    }
  }

  // @ts-ignore
  globalThis.ExecutionContext = ExecutionContext;
}
