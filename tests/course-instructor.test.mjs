import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { COURSES, INITIAL_STATE } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';

test('every course shows an instructor card and concise background', () => {
  for (const course of COURSES) {
    const html = renderDiscover(`/learn/courses/${course.id}`, INITIAL_STATE);
    assert.match(html, /class="course-instructor"/);
    assert.ok(html.includes(course.instructor));
    assert.ok(html.includes(course.instructorBackground ?? 'The Aura editorial team'));
    if (course.instructorPortrait) assert.ok(existsSync(`.${course.instructorPortrait}`));
    assert.ok(html.includes(`/learn/courses/${course.id}/book`));
  }
});
