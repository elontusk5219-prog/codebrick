import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { Registry } from '../src/server/hub';
import { createHttpServer, type HttpHandle } from '../src/server/http';
import { makeForwarder } from '../src/server/reporter';

const webRoot = join(process.cwd(), 'src', 'web');
let handle: HttpHandle | null = null;

afterEach(async () => {
  if (handle) {
    await handle.close();
    handle = null;
  }
});

const A = { type: 'node.add', id: 'a', label: 'A', kind: 'stage' } as const;

describe('reporter forwarder', () => {
  it('forwards events to the daemon under the right project', async () => {
    const reg = new Registry();
    handle = createHttpServer(reg, { webRoot });
    const port: number = await new Promise((r) =>
      handle!.server.listen(0, () => r((handle!.server.address() as AddressInfo).port)),
    );

    const forward = makeForwarder(`http://localhost:${port}`, 'my-svc', 'My Service');
    const n = await forward([A]);

    expect(n).toBe(1);
    expect(reg.getLog('my-svc')).toHaveLength(1);
    expect(reg.listProjects()[0]).toMatchObject({ id: 'my-svc', label: 'My Service' });
  });

  it('rejects when the daemon is unreachable', async () => {
    const forward = makeForwarder('http://localhost:1', 'x'); // nothing listening
    await expect(forward([A])).rejects.toThrow();
  });
});
