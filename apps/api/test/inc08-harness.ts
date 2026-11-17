import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { Role } from '../src/auth/roles.decorator';

export const syntheticTriage = { chiefComplaint: 'Caso ficticio Inc08', spo2: 98, glasgow: 15, eva: 1, paroInminente: false, dolorToracicoTipico: false };
const roles: Role[]=['ENFERMERO','MEDICO','ADMISIONES','COORDINADOR','SERVICIOS','AUDITOR'];
export class Inc08Harness {
  readonly schema=`sitcama_inc08_${randomUUID().replaceAll('-','')}`;
  readonly actors={} as Record<Role,string>;
  readonly tokens={} as Record<Role,string>;
  readonly password=randomBytes(30).toString('base64url');
  private readonly originalEnv={...process.env};
  private admin?: Pool;
  private created=false;
  app?: INestApplication;
  sql!: Pool;
  base='';
  async start() {
    if(!['TEST_PGHOST','TEST_PGPORT','TEST_PGDATABASE','TEST_PGUSER','TEST_PGPASSWORD'].every(key=>process.env[key]) ||
      !/^(sitcama_ci|sitcama_dast|sitcama_inc08_[a-f0-9]+)$/.test(process.env.TEST_PGDATABASE!)) throw new Error('Use a disposable CI test runner; no local .env fallback is allowed');
    const connection={host:process.env.TEST_PGHOST,port:Number(process.env.TEST_PGPORT),database:process.env.TEST_PGDATABASE,
      user:process.env.TEST_PGUSER,password:process.env.TEST_PGPASSWORD,connectionTimeoutMillis:3000};
    this.admin=new Pool({...connection,options:'-c search_path=pg_catalog'});
    await this.admin.query(`CREATE SCHEMA "${this.schema}"`);this.created=true;
    this.sql=new Pool({...connection,options:`-c search_path=${this.schema}`});
    await this.sql.query(readFileSync(resolve(__dirname,'../db/001_initial.sql'),'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    Object.assign(process.env,{PGHOST:connection.host,PGPORT:String(connection.port),PGDATABASE:connection.database,PGUSER:connection.user,
      PGPASSWORD:connection.password,PGOPTIONS:`-c search_path=${this.schema}`,JWT_SECRET:randomBytes(48).toString('base64'),
      PATIENT_DATA_KEY:randomBytes(32).toString('base64'),PATIENT_HMAC_KEY:randomBytes(32).toString('base64'),NODE_ENV:'test'});
    const hash=await argon2.hash(this.password);
    for(const role of roles){this.actors[role]=randomUUID();await this.sql.query('INSERT INTO users(id,email,role,password_hash) VALUES($1,$2,$3,$4)',[this.actors[role],`${role.toLowerCase()}@inc08.test`,role,hash]);}
    this.app=await NestFactory.create(AppModule,{logger:false,abortOnError:false});configureApp(this.app);await this.app.listen(0,'127.0.0.1');this.base=await this.app.getUrl();
    for(const role of roles)this.tokens[role]=await this.app.get(JwtService).signAsync({sub:this.actors[role],role});
  }
  async request(path:string,method='GET',role?:Role,body?:unknown,token?:string){
    const response=await fetch(`${this.base}/api${path}`,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),
      ...(role||token?{Authorization:`Bearer ${token??this.tokens[role!]}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return{status:response.status,body:await response.json() as any,headers:response.headers};
  }
  async patient(){const document=`INC08-${randomBytes(8).toString('hex')}`;const response=await this.request('/patients','POST','MEDICO',
    {document,fullName:'Persona Sintética',triage:{...syntheticTriage,spo2:84}});expect(response.status).toBe(201);return response.body;}
  async close(){
    try{await this.app?.close();await this.sql?.end();if(this.created){if(!/^sitcama_inc08_[a-f0-9]{32}$/.test(this.schema))throw new Error('Unsafe test schema');await this.admin!.query(`DROP SCHEMA "${this.schema}" CASCADE`);}}
    finally{await this.admin?.end();for(const key of Object.keys(process.env))if(!(key in this.originalEnv))delete process.env[key];Object.assign(process.env,this.originalEnv);}
  }
}
