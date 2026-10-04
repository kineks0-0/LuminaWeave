import{n as e,t}from"./CommonUtils.js";async function n(e,t={},n){return window.__TAURI_INTERNALS__.invoke(e,t,n)}var r=class e{constructor(e){this.path=e}static async load(t){let r=await n(`plugin:sql|load`,{db:t});return new e(r)}static get(t){return new e(t)}async execute(e,t){let[r,i]=await n(`plugin:sql|execute`,{db:this.path,query:e,values:t??[]});return{lastInsertId:i,rowsAffected:r}}async select(e,t){return await n(`plugin:sql|select`,{db:this.path,query:e,values:t??[]})}async close(e){return await n(`plugin:sql|close`,{db:e})}},i=`main`,a=`sqlite:luminaweave-runtime-store.db`,o=e=>e||i,s=(e,t,n,r)=>`${r}\u0000${e}\u0000${t}\u0000${n}`,c=e=>new TextEncoder().encode(e).byteLength,l=e=>{let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),t},u=e=>new Uint8Array(e),d=e=>{let t=new Uint8Array(e.byteLength);return t.set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),t},f=(e,t)=>e&&t&&typeof e==`object`&&typeof t==`object`&&!Array.isArray(e)&&!Array.isArray(t)?{...e,...t}:t,p=class{backend=`tauri-sqlite`;databasePath;dbPromise=null;constructor(e={}){this.databasePath=e.databasePath??a}async getJson(e){let t=await this.getRecord(e.namespace,o(e.table),e.key,`json`);return t?.value_json?JSON.parse(t.value_json):null}async setJson(e){await this.putJsonRecord(e.namespace,o(e.table),e.key,e.value)}async updateJson(e){let t=o(e.table),n=await this.getJson({namespace:e.namespace,table:t,key:e.key});await this.putJsonRecord(e.namespace,t,e.key,f(n,e.value))}async deleteJson(e){await this.deleteRecord({namespace:e.namespace,table:o(e.table),key:e.key,kind:`json`})}async listKeys(e){return(await(await this.getDb()).select(`SELECT record_key
             FROM extension_store_records
             WHERE namespace = $1 AND table_name = $2 AND kind = $3
             ORDER BY record_key ASC`,[e.namespace,o(e.table),`json`])).map(e=>e.record_key)}async setBlob(e){await this.putBlobRecord(e.namespace,o(e.table),e.key,e.data)}async getBlob(e){let n=await this.getRecord(e.namespace,o(e.table),e.key,`blob`);return n?.value_blob_base64?new Blob([l(t(n.value_blob_base64))]):null}async listRecords(){return(await(await this.getDb()).select(`SELECT namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at
             FROM extension_store_records
             ORDER BY namespace ASC, table_name ASC, record_key ASC, kind ASC`)).map(e=>({backend:this.backend,namespace:e.namespace,table:e.table_name,key:e.record_key,kind:e.kind,bytes:e.bytes,updatedAt:e.updated_at}))}async deleteRecord(e){await(await this.getDb()).execute(`DELETE FROM extension_store_records
             WHERE id = $1`,[s(e.namespace,o(e.table),e.key,e.kind)])}async importRecords(e){for(let t of e)t.kind===`json`?await this.putJsonRecord(t.namespace,o(t.table),t.key,t.value):await this.putBlobRecord(t.namespace,o(t.table),t.key,t.value);return{imported:e.length}}async exportRecords(e={}){let t=(await this.selectRows(e)).map(e=>({namespace:e.namespace,table:e.table_name,key:e.record_key,kind:e.kind,value:e.kind===`json`?JSON.parse(e.value_json??`null`):e.value_blob_base64??``}));return{version:1,exportedAt:Date.now(),records:t}}async getDb(){return this.dbPromise||=(async()=>{let e=await r.load(this.databasePath);return await e.execute(`CREATE TABLE IF NOT EXISTS extension_store_records (
                        id TEXT PRIMARY KEY,
                        namespace TEXT NOT NULL,
                        table_name TEXT NOT NULL,
                        record_key TEXT NOT NULL,
                        kind TEXT NOT NULL,
                        value_json TEXT,
                        value_blob_base64 TEXT,
                        bytes INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )`),await e.execute(`CREATE INDEX IF NOT EXISTS extension_store_records_scope_idx
                     ON extension_store_records (namespace, table_name, kind, record_key)`),e})(),this.dbPromise}async getRecord(e,t,n,r){return(await(await this.getDb()).select(`SELECT namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at
             FROM extension_store_records
             WHERE id = $1
             LIMIT 1`,[s(e,t,n,r)]))[0]??null}async putJsonRecord(e,t,n,r){let i=JSON.stringify(r);await this.upsertRecord(e,t,n,`json`,i,null,c(i))}async putBlobRecord(t,n,r,i){let a=await this.blobValueToBytes(i);await this.upsertRecord(t,n,r,`blob`,null,e(a),a.byteLength)}async upsertRecord(e,t,n,r,i,a,o){await(await this.getDb()).execute(`INSERT INTO extension_store_records
                (id, namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT(id) DO UPDATE SET
                value_json = excluded.value_json,
                value_blob_base64 = excluded.value_blob_base64,
                bytes = excluded.bytes,
                updated_at = excluded.updated_at`,[s(e,t,n,r),e,t,n,r,i,a,o,Date.now()])}async selectRows(e){let t=await this.getDb(),n=[],r=[];e.namespace&&(r.push(e.namespace),n.push(`namespace = $${r.length}`)),e.table&&(r.push(e.table),n.push(`table_name = $${r.length}`)),e.kind&&(r.push(e.kind),n.push(`kind = $${r.length}`));let i=n.length>0?`WHERE ${n.join(` AND `)}`:``;return await t.select(`SELECT namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at
             FROM extension_store_records
             ${i}
             ORDER BY namespace ASC, table_name ASC, record_key ASC, kind ASC`,r)}async blobValueToBytes(e){return e instanceof Blob?u(await e.arrayBuffer()):e instanceof ArrayBuffer?u(e):ArrayBuffer.isView(e)?d(e):typeof e==`string`?new TextEncoder().encode(e):new TextEncoder().encode(JSON.stringify(e))}};export{p as TauriSqliteExtensionStore};