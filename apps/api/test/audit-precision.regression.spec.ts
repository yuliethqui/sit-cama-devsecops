import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Inc08Harness } from './inc08-harness';

jest.setTimeout(20000);
describe('Incremento 08: filtros y cursor con precisión PostgreSQL',()=>{
  const h=new Inc08Harness();beforeAll(()=>h.start());afterAll(()=>h.close());
  const filter=(extra:Record<string,string>)=>'/audit/events?'+new URLSearchParams({actorId:h.actors.COORDINADOR,action:'SEARCH_PATIENT',entityType:'patient',...extra}).toString();
  async function event(at:string){return(await h.sql.query("INSERT INTO audit_events(actor_id,entity_type,entity_id,action,recorded_at) VALUES($1,'patient',$2,'SEARCH_PATIENT',$3::timestamptz) RETURNING id::text",[h.actors.COORDINADOR,randomUUID(),at])).rows[0].id as string;}

  it('incluye ambos extremos exactos y reconoce offsets equivalentes sin incluir microsegundos vecinos',async()=>{
    await event('2026-01-01T00:00:00.123455Z');
    const expected=await event('2026-01-01T00:00:00.123456Z');
    await event('2026-01-01T00:00:00.123457Z');
    const response=await h.request(filter({from:'2026-01-01T00:00:00.123456Z',to:'2025-12-31T19:00:00.123456-05:00'}),'GET','AUDITOR');
    expect(response.status).toBe(200);expect(response.body.items.map((item:{id:string})=>item.id)).toEqual([expected]);expect(response.body.nextCursor).toBeNull();
  });
  it('el cursor numérico no repite ni omite el conjunto inicial al insertar un evento entre páginas',async()=>{
    const ids:string[]=[];for(let i=0;i<5;i++)ids.push(await event(`2030-01-01T00:00:0${i}Z`));
    const filters={from:'2030-01-01T00:00:00Z',to:'2030-12-31T23:59:59Z',limit:'2'};
    const first=await h.request(filter(filters),'GET','AUDITOR');expect(first.status).toBe(200);
    const received:string[]=first.body.items.map((item:{id:string})=>item.id);
    const inserted=await event('2030-01-02T00:00:00Z');
    let cursor=first.body.nextCursor as string|null;
    for(let page=0;cursor!==null&&page<3;page++){
      const response=await h.request(filter({...filters,cursor}),'GET','AUDITOR');expect(response.status).toBe(200);
      expect(response.body.items.every((item:{id:unknown})=>typeof item.id==='string')).toBe(true);
      received.push(...response.body.items.map((item:{id:string})=>item.id));cursor=response.body.nextCursor;
    }
    expect(cursor).toBeNull();expect(received).toEqual([...ids].reverse());expect(new Set(received).size).toBe(ids.length);expect(received).not.toContain(inserted);
    const refreshed=await h.request(filter(filters),'GET','AUDITOR');expect(refreshed.body.items[0].id).toBe(inserted);
  });
  it('rechaza un rango invertido de un microsegundo con 400 y sin registrar una lectura válida',async()=>{
    const from='2026-01-01T00:00:00.123457Z',to='2026-01-01T00:00:00.123456Z';
    const count=async()=>Number((await h.sql.query("SELECT count(*)::int AS n FROM audit_events WHERE actor_id=$1 AND action='READ_AUDIT'",[h.actors.AUDITOR])).rows[0].n);
    const before=await count();
    const response=await h.request(filter({from,to}),'GET','AUDITOR');
    const after=await count();
    if(process.env.SITCAMA_TEST_EVIDENCE_DIR){writeFileSync(resolve(process.env.SITCAMA_TEST_EVIDENCE_DIR,'audit-observation.json'),JSON.stringify({
      input:{from,to},expectedStatus:400,actualStatus:response.status,response:response.body,
      javascriptFromMillis:Date.parse(from),javascriptToMillis:Date.parse(to),auditReadsBefore:before,auditReadsAfter:after,
      scope:'Fresh Inc08 schema in disposable PostgreSQL; no production patient/credential data',
    },null,2)+'\n');}
    expect(response.status).toBe(400);
    expect(after).toBe(before);
  });
});
