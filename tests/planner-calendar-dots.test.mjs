import assert from 'node:assert/strict';
import {test} from 'node:test';
import {markedTaskDates,renderCalendar} from '../src/schedule.mjs';

test('planner marks the full displayed month and recalculates for another month',()=>{
 const tasks=['2026-10-01','2026-10-20','2026-11-12'].map((dueDate,index)=>({id:String(index),farmId:'land',title:'Water',dueDate,time:'08:00',done:false,repeat:'none'}));
 const october=markedTaskDates(tasks,'2026-10');
 assert.ok(october.includes('2026-10-01'));
 assert.ok(october.includes('2026-10-20'));
 assert.ok(!october.includes('2026-11-12'));
 assert.ok(markedTaskDates(tasks,'2026-11').includes('2026-11-12'));
 const html=renderCalendar('2026-10-20','2026-10',true,october,false);
 assert.match(html,/data-calendar-date="2026-10-20"[^]*?<i aria-hidden="true"><\/i>/);
 assert.deepEqual(markedTaskDates(tasks.map(task=>({...task,done:true})),'2026-10'),[]);
});
