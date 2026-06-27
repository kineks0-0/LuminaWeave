async function e(e,t={},n){return window.__TAURI_INTERNALS__.invoke(e,t,n)}var t=class t{constructor(e){this.path=e}static async load(n){return new t(await e(`plugin:sql|load`,{db:n}))}static get(e){return new t(e)}async execute(t,n){let[r,i]=await e(`plugin:sql|execute`,{db:this.path,query:t,values:n??[]});return{lastInsertId:i,rowsAffected:r}}async select(t,n){return await e(`plugin:sql|select`,{db:this.path,query:t,values:n??[]})}async close(t){return await e(`plugin:sql|close`,{db:t})}},n=`main`,r=`sqlite:luminaweave-runtime-store.db`,i=e=>e||n,a=(e,t,n,r)=>`${r}\u0000${e}\u0000${t}\u0000${n}`,o=e=>new TextEncoder().encode(e).byteLength,s=e=>{let t=``;for(let n of e)t+=String.fromCharCode(n);return btoa(t)},c=e=>{let t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;e+=1)n[e]=t.charCodeAt(e);return n},l=e=>{let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),t},u=e=>new Uint8Array(e),d=e=>{let t=new Uint8Array(e.byteLength);return t.set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),t},f=(e,t)=>e&&t&&typeof e==`object`&&typeof t==`object`&&!Array.isArray(e)&&!Array.isArray(t)?{...e,...t}:t,p=class{backend=`tauri-sqlite`;databasePath;dbPromise=null;constructor(e={}){this.databasePath=e.databasePath??r}async getJson(e){let t=await this.getRecord(e.namespace,i(e.table),e.key,`json`);return t?.value_json?JSON.parse(t.value_json):null}async setJson(e){await this.putJsonRecord(e.namespace,i(e.table),e.key,e.value)}async updateJson(e){let t=i(e.table),n=await this.getJson({namespace:e.namespace,table:t,key:e.key});await this.putJsonRecord(e.namespace,t,e.key,f(n,e.value))}async deleteJson(e){await this.deleteRecord({namespace:e.namespace,table:i(e.table),key:e.key,kind:`json`})}async listKeys(e){return(await(await this.getDb()).select(`SELECT record_key
             FROM extension_store_records
             WHERE namespace = $1 AND table_name = $2 AND kind = $3
             ORDER BY record_key ASC`,[e.namespace,i(e.table),`json`])).map(e=>e.record_key)}async setBlob(e){await this.putBlobRecord(e.namespace,i(e.table),e.key,e.data)}async getBlob(e){let t=await this.getRecord(e.namespace,i(e.table),e.key,`blob`);return t?.value_blob_base64?new Blob([l(c(t.value_blob_base64))]):null}async listRecords(){return(await(await this.getDb()).select(`SELECT namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at
             FROM extension_store_records
             ORDER BY namespace ASC, table_name ASC, record_key ASC, kind ASC`)).map(e=>({backend:this.backend,namespace:e.namespace,table:e.table_name,key:e.record_key,kind:e.kind,bytes:e.bytes,updatedAt:e.updated_at}))}async deleteRecord(e){await(await this.getDb()).execute(`DELETE FROM extension_store_records
             WHERE id = $1`,[a(e.namespace,i(e.table),e.key,e.kind)])}async importRecords(e){for(let t of e)t.kind===`json`?await this.putJsonRecord(t.namespace,i(t.table),t.key,t.value):await this.putBlobRecord(t.namespace,i(t.table),t.key,t.value);return{imported:e.length}}async exportRecords(e={}){let t=(await this.selectRows(e)).map(e=>({namespace:e.namespace,table:e.table_name,key:e.record_key,kind:e.kind,value:e.kind===`json`?JSON.parse(e.value_json??`null`):e.value_blob_base64??``}));return{version:1,exportedAt:Date.now(),records:t}}async getDb(){return this.dbPromise||=(async()=>{let e=await t.load(this.databasePath);return await e.execute(`CREATE TABLE IF NOT EXISTS extension_store_records (
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
             LIMIT 1`,[a(e,t,n,r)]))[0]??null}async putJsonRecord(e,t,n,r){let i=JSON.stringify(r);await this.upsertRecord(e,t,n,`json`,i,null,o(i))}async putBlobRecord(e,t,n,r){let i=await this.blobValueToBytes(r);await this.upsertRecord(e,t,n,`blob`,null,s(i),i.byteLength)}async upsertRecord(e,t,n,r,i,o,s){await(await this.getDb()).execute(`INSERT INTO extension_store_records
                (id, namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT(id) DO UPDATE SET
                value_json = excluded.value_json,
                value_blob_base64 = excluded.value_blob_base64,
                bytes = excluded.bytes,
                updated_at = excluded.updated_at`,[a(e,t,n,r),e,t,n,r,i,o,s,Date.now()])}async selectRows(e){let t=await this.getDb(),n=[],r=[];e.namespace&&(r.push(e.namespace),n.push(`namespace = $${r.length}`)),e.table&&(r.push(e.table),n.push(`table_name = $${r.length}`)),e.kind&&(r.push(e.kind),n.push(`kind = $${r.length}`));let i=n.length>0?`WHERE ${n.join(` AND `)}`:``;return await t.select(`SELECT namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at
             FROM extension_store_records
             ${i}
             ORDER BY namespace ASC, table_name ASC, record_key ASC, kind ASC`,r)}async blobValueToBytes(e){return e instanceof Blob?u(await e.arrayBuffer()):e instanceof ArrayBuffer?u(e):ArrayBuffer.isView(e)?d(e):typeof e==`string`?new TextEncoder().encode(e):new TextEncoder().encode(JSON.stringify(e))}};export{p as TauriSqliteExtensionStore};