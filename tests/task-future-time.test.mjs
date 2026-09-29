import assert from 'node:assert/strict';
import {test} from 'node:test';
import {submitForm} from '../src/actions.mjs';
import {INITIAL_STATE} from '../src/data.mjs';

test('task save rejects past dates and earlier times today without adding records',()=>{
 const state=structuredClone(INITIAL_STATE);
 state.farms=[{id:'land',plots:[]}]; state.tasks=[];
 const past=new Date(Date.now()-120000);
 const date=[past.getFullYear(),String(past.getMonth()+1).padStart(2,'0'),String(past.getDate()).padStart(2,'0')].join('-');
 const time=[past.getHours(),past.getMinutes()].map(n=>String(n).padStart(2,'0')).join(':');
 const fields={farmId:'land',title:'Water',category:'Water',time,repeat:'none'};
 for(const dueDate of ['2000-01-01',date]) assert.throws(()=>submitForm(state,'task',{...fields,dueDate}),/future task/);
 assert.equal(state.tasks.length,0);
 submitForm(state,'task',{...fields,dueDate:'2099-01-01'});
 assert.equal(state.tasks.length,1);
 assert.throws(()=>submitForm(state,'task',{...fields,id:state.tasks[0].id,dueDate:'2000-01-01'}),/future task/);
 assert.equal(state.tasks[0].dueDate,'2099-01-01');
});
