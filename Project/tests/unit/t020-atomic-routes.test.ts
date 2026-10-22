import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';

/**
 * T-020 单元测试：R1 保存点位原子化 + R2 核销 CAS（mock Supabase client，不连库）。
 * 覆盖：
 *  1. places PUT 失败 → 返回 500，且不再出现 delete/insert 直写（原子性交给 DB 函数，失败不清空）；
 *  2. places PUT 成功 → 走 rpc('replace_route_places')，参数为 snake_case items，返回行数；
 *  3. 核销 rpc 返回 NOT_PENDING → 409「该订单已处理」；
 *  4. 核销 rpc 返回 OK → 200 approved，且 p_days 取自 BUSINESS.MEMBER_PLANS。
 */

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}
interface QueryResult {
  data?: unknown;
  error?: unknown;
}

const h = vi.hoisted(() => {
  const state = {
    deleteCalls: 0,
    insertCalls: 0,
    rpcCalls: [] as RpcCall[],
    rpcImpl: async (_fn: string, _args: Record<string, unknown>): Promise<QueryResult> => ({
      data: null,
      error: null,
    }),
    serverTables: {} as Record<string, () => Promise<QueryResult>>,
    adminTables: {} as Record<string, () => Promise<QueryResult>>,
    user: { id: 'user-1' } as { id: string } | null,
  };

  /** 链式查询构造器：记录 route_places 上的 delete/insert 直写次数 */
  class FakeBuilder {
    private exec: () => Promise<QueryResult>;
    constructor(exec: () => Promise<QueryResult>) {
      this.exec = exec;
    }
    select() {
      return this;
    }
    eq() {
      return this;
    }
    in() {
      return this;
    }
    update() {
      return this;
    }
    delete() {
      state.deleteCalls += 1;
      return this.exec();
    }
    insert() {
      state.insertCalls += 1;
      return this.exec();
    }
    maybeSingle() {
      return this.exec();
    }
    then(onFulfilled?: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) {
      return this.exec().then(onFulfilled, onRejected);
    }
  }

  const makeClient = (tables: () => Record<string, () => Promise<QueryResult>>) => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
    from: (table: string) => {
      const map = tables();
      const resolver = map[table] ?? (async () => ({ data: null }));
      return new FakeBuilder(() => resolver());
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      return state.rpcImpl(fn, args);
    },
  });

  return {
    state,
    makeServerClient: () => makeClient(() => state.serverTables),
    makeAdminClient: () => makeClient(() => state.adminTables),
  };
});

vi.mock('@/lib/supabase/server', () => ({ createClient: () => h.makeServerClient() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => h.makeAdminClient() }));
vi.mock('@/lib/member-quota', () => ({
  getQuotaProfile: async () => ({ tier: 'member' }),
  limitsOf: () => ({ placesPerDay: 99 }),
}));

// eslint-disable-next-line import/first
import { PUT } from '@/app/api/routes/[id]/places/route';
// eslint-disable-next-line import/first
import { POST } from '@/app/api/admin/member/orders/[id]/route';

function jsonRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  h.state.deleteCalls = 0;
  h.state.insertCalls = 0;
  h.state.rpcCalls = [];
  h.state.rpcImpl = async () => ({ data: null, error: null });
  h.state.user = { id: 'user-1' };
  h.state.serverTables = {
    routes: async () => ({ data: { id: 'route-1', days: 2 } }),
    places: async () => ({ data: [{ id: 'p-1' }, { id: 'p-2' }] }),
  };
  h.state.adminTables = {
    member_orders: async () => ({ data: { id: 'o-1', user_id: 'u-2', plan: 'month', status: 'pending' } }),
    users: async () => ({ data: { id: 'u-2', role: 'user' } }),
  };
  // 服务端 client 的管理员身份检查（核销接口）
  h.state.serverTables.users = async () => ({ data: { role: 'admin' } });
});

describe('R1 PUT /api/routes/[id]/places → replace_route_places 原子替换', () => {
  const items = [
    { placeId: 'p-1', dayIndex: 0, orderIndex: 0 },
    { placeId: 'p-2', dayIndex: 0, orderIndex: 1 },
  ];

  it('rpc 失败时返回 500，且不出现 delete/insert 直写（原数据不被清空）', async () => {
    h.state.rpcImpl = async () => ({ data: null, error: { message: 'insert failed' } });

    const res = await PUT(jsonRequest({ items }), { params: { id: 'route-1' } });
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(h.state.rpcCalls).toHaveLength(1);
    // 关键断言：改造点不再发 delete+insert 两次独立请求（旧实现先删后插的丢数据路径已移除）
    expect(h.state.deleteCalls).toBe(0);
    expect(h.state.insertCalls).toBe(0);
  });

  it('rpc 成功时返回插入行数，参数为 snake_case items', async () => {
    h.state.rpcImpl = async () => ({ data: 2, error: null });

    const res = await PUT(jsonRequest({ items }), { params: { id: 'route-1' } });
    const body = (await res.json()) as { ok: boolean; count: number };

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, count: 2 });
    expect(h.state.rpcCalls[0].fn).toBe('replace_route_places');
    expect(h.state.rpcCalls[0].args).toEqual({
      p_route_id: 'route-1',
      p_items: [
        { place_id: 'p-1', day_index: 0, order_index: 0 },
        { place_id: 'p-2', day_index: 0, order_index: 1 },
      ],
    });
  });
});

describe('R2 POST /api/admin/member/orders/[id] → approve_member_order CAS', () => {
  it('rpc 返回 NOT_PENDING（并发已被核销）→ 409 且提示已处理', async () => {
    h.state.rpcImpl = async () => ({ data: { result: 'NOT_PENDING' }, error: null });

    const res = await POST(jsonRequest({ approve: true }), { params: { id: 'o-1' } });
    const body = (await res.json()) as { ok: boolean; message: string };

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.message).toBe(MESSAGES.ADMIN_ORDERS.errNotPending);
    expect(h.state.rpcCalls[0].fn).toBe('approve_member_order');
  });

  it('rpc 返回 OK → 200 approved，p_days 取自套餐（month=30）', async () => {
    h.state.rpcImpl = async () => ({ data: { result: 'OK', user_id: 'u-2' }, error: null });

    const res = await POST(jsonRequest({ approve: true }), { params: { id: 'o-1' } });
    const body = (await res.json()) as { ok: boolean; status: string };

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, status: 'approved' });
    expect(h.state.rpcCalls[0].args).toEqual({
      p_order_id: 'o-1',
      p_admin: 'user-1',
      p_days: 30,
    });
  });
});
