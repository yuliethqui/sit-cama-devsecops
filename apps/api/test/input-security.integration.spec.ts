import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { PatientDataService } from '../src/patients/patient-data.service';
import { Inc08Harness, syntheticTriage } from './inc08-harness';

jest.setTimeout(20000);
describe('Incremento 08: entradas hostiles y transacciones aisladas',()=>{
  const h=new Inc08Harness();
  beforeAll(()=>h.start());afterAll(()=>h.close());
  const input=()=>({document:`INC08-${randomBytes(8).toString('hex')}`,fullName:'Persona Sintética',triage:{...syntheticTriage}});
  it.each([
    ['nombre nulo',{fullName:null}],['nombre numérico',{fullName:123}],['nombre objeto',{fullName:{name:'Demo'}}],['nombre array',{fullName:['Demo']}],
    ['motivo nulo',{triage:{...syntheticTriage,chiefComplaint:null}}],['motivo numérico',{triage:{...syntheticTriage,chiefComplaint:123}}],
    ['Glasgow decimal',{triage:{...syntheticTriage,glasgow:9.5}}],['EVA decimal',{triage:{...syntheticTriage,eva:7.5}}],
    ['Glasgow string',{triage:{...syntheticTriage,glasgow:'15'}}],['EVA booleano',{triage:{...syntheticTriage,eva:true}}],
    ['saturación objeto',{triage:{...syntheticTriage,spo2:{value:98}}}],['booleano array',{triage:{...syntheticTriage,paroInminente:[]}}],
  ])('rechaza %s sin persistencia parcial ni eco de entrada',async(_name,change)=>{
    const before=(await h.sql.query('SELECT (SELECT count(*) FROM patients)::int AS patients,(SELECT count(*) FROM audit_events)::int AS audits')).rows;
    const response=await h.request('/patients','POST','MEDICO',{...input(),...change});
    expect(response.status).toBe(400);expect(response.body).toEqual({statusCode:400,message:'Datos de entrada inválidos'});
    expect((await h.sql.query('SELECT (SELECT count(*) FROM patients)::int AS patients,(SELECT count(*) FROM audit_events)::int AS audits')).rows).toEqual(before);
  });
  it.each([
    ['mínimos',3,2,1],['máximos',40,160,1000],
  ])('admite longitudes %s exactas tras trim',async(_name,documentSize,nameSize,complaintSize)=>{
    const body={document:'D'.repeat(documentSize as number),fullName:'Ñ'.repeat(nameSize as number),triage:{...syntheticTriage,chiefComplaint:'ó'.repeat(complaintSize as number)}};
    const result=await h.request('/patients','POST','MEDICO',{...body,fullName:` ${body.fullName} `});expect(result.status).toBe(201);
    expect((await h.request('/patients/search','POST','ADMISIONES',{document:body.document})).body.patientId).toBe(result.body.patientId);
  });
  it.each([
    '<img src=x onerror="window.__inc08=true">',
    "O'Neil'); DROP TABLE beds; --",
  ])('trata texto sintético como dato cifrado, nunca como SQL ni respuesta pública: %s',async text=>{
    const body={...input(),fullName:text,triage:{...syntheticTriage,chiefComplaint:text}};
    const saved=await h.request('/patients','POST','MEDICO',body);expect(saved.status).toBe(201);
    const found=await h.request('/patients/search','POST','ADMISIONES',{document:body.document});expect(found.status).toBe(200);
    expect(Object.keys(found.body).sort()).toEqual(['createdAt','latestTriage','patientId','provisional','triageStatus']);expect(JSON.stringify(found.body)).not.toContain(text);
    const row=(await h.sql.query('SELECT identity_ciphertext FROM patients WHERE id=$1',[saved.body.patientId])).rows[0];
    expect(row.identity_ciphertext.includes(Buffer.from(text))).toBe(false);
    expect(h.app!.get(PatientDataService).decrypt(row.identity_ciphertext,`identity:${saved.body.patientId}`)).toEqual({document:body.document.toUpperCase(),fullName:text});
    const read=await h.request(`/patients/${saved.body.patientId}/triage/latest`,'GET','MEDICO');expect(read.body.clinical.chiefComplaint).toBe(text);
    expect((await h.request('/beds','GET','SERVICIOS')).body).toHaveLength(38);
  });
  it('un código de cama con SQLi no amplía la consulta ni revela ocupaciones',async()=>{
    const response=await h.request(`/beds/${encodeURIComponent("UA-01' OR '1'='1")}/assignment`,'GET','MEDICO');
    expect(response.status).toBe(404);expect(response.body).toEqual({statusCode:404,message:'Recurso no encontrado'});
    expect((await h.request('/beds','GET','SERVICIOS')).body).toHaveLength(38);
  });
  it('login no acepta permisos aportados por el cliente',async()=>{
    const result=await h.request('/auth/login','POST',undefined,{email:'servicios@inc08.test',password:h.password,role:'MEDICO'});
    expect(result.status).toBe(400);expect(result.body.access_token).toBeUndefined();
  });
  it.each(['payload modificado','sin firma','HS384','not-before futuro'])('rechaza JWT %s aunque tenga estructura válida',async kind=>{
    const jwt=h.app!.get(JwtService);let token:string;
    if(kind==='payload modificado'){const parts=h.tokens.SERVICIOS.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());parts[1]=Buffer.from(JSON.stringify({...payload,role:'AUDITOR'})).toString('base64url');token=parts.join('.');}
    else if(kind==='sin firma')token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+h.tokens.AUDITOR.split('.')[1]+'.';
    else token=await jwt.signAsync({sub:h.actors.AUDITOR,role:'AUDITOR'},kind==='HS384'?{algorithm:'HS384'}:{notBefore:60});
    const result=await h.request('/audit/events','GET',undefined,undefined,token);expect(result.status).toBe(401);expect(result.body).toEqual({statusCode:401,message:'Autenticación requerida'});
  });
  it('espera el commit del triaje concurrente y rechaza asignar si ahora requiere revisión',async()=>{
    const saved=await h.patient(),client=await h.sql.connect();let pending:ReturnType<typeof h.request>|undefined;
    try{
      await client.query('BEGIN');await client.query('SELECT id FROM patients WHERE id=$1 FOR UPDATE',[saved.patientId]);
      pending=h.request('/beds/UA-01/assign','POST','MEDICO',{patientId:saved.patientId,service:'URGENCIAS_ADULTOS'});
      let blocked=false;
      for(let i=0;i<25;i++){const found=await h.sql.query("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM patients WHERE id=$1 FOR UPDATE%') AS waiting");if(found.rows[0].waiting){blocked=true;break;}await new Promise(r=>setTimeout(r,50));}
      expect(blocked).toBe(true);
      const id=randomUUID(),encrypted=h.app!.get(PatientDataService).encrypt(syntheticTriage,`triage:${saved.patientId}:${id}`);
      await client.query('INSERT INTO triage_records(id,patient_id,level,max_wait_minutes,clinical_payload_ciphertext,requires_clinical_review,created_by,created_at) VALUES($1,$2,NULL,NULL,$3,true,$4,clock_timestamp())',[id,saved.patientId,encrypted,h.actors.MEDICO]);
      await client.query('COMMIT');expect((await pending).status).toBe(409);
      expect((await h.sql.query("SELECT status FROM beds WHERE code='UA-01'")).rows[0].status).toBe('AVAILABLE');
      expect((await h.sql.query('SELECT count(*)::int AS n FROM bed_assignments WHERE patient_id=$1',[saved.patientId])).rows[0].n).toBe(0);
    }finally{await client.query('ROLLBACK');client.release();if(pending)await pending;}
  });
  it('un fallo diferido al COMMIT revierte también la auditoría ya insertada',async()=>{
    const saved=await h.patient();
    await h.sql.query("CREATE FUNCTION reject_inc08_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_COMMIT_FAILURE' USING ERRCODE='23514'; END; $$; CREATE CONSTRAINT TRIGGER reject_inc08_commit AFTER INSERT ON bed_assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_inc08_commit();");
    try{
      const result=await h.request('/beds/UA-02/assign','POST','MEDICO',{patientId:saved.patientId,service:'URGENCIAS_ADULTOS'});
      expect(result.status).toBe(500);expect(JSON.stringify(result.body)).not.toContain('SYNTHETIC');
      expect((await h.sql.query("SELECT status FROM beds WHERE code='UA-02'")).rows[0].status).toBe('AVAILABLE');
      expect((await h.sql.query('SELECT count(*)::int AS n FROM bed_assignments WHERE patient_id=$1',[saved.patientId])).rows[0].n).toBe(0);
      expect((await h.sql.query("SELECT count(*)::int AS n FROM audit_events WHERE action='ASSIGN_BED' AND entity_id='UA-02'")).rows[0].n).toBe(0);
    }finally{await h.sql.query('DROP TRIGGER reject_inc08_commit ON bed_assignments;DROP FUNCTION reject_inc08_commit();');}
    expect((await h.request('/beds/UA-02/assign','POST','MEDICO',{patientId:saved.patientId,service:'URGENCIAS_ADULTOS'})).status).toBe(201);
  });
});
