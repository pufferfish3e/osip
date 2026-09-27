import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureFormState, restoreFormState } from '../src/language.mjs';

const control = (name, value, options={}) => ({name,value,tagName:'INPUT',getAttribute:()=>name,...options});
const root = (fields, details=[]) => ({querySelectorAll:(selector)=>selector==='details'?details:fields});

test('language rerenders preserve drafts, checks and expanded details without preserving the old locale', () => {
  const old = root([control('title','未完成 <farm>'),control('reminder','on',{checked:true}),control('language','en',{tagName:'SELECT'})],[{open:true}]);
  const freshFields = [control('title',''),control('reminder','on',{checked:false}),control('language','ms',{tagName:'SELECT'})];
  const freshDetails = [{open:false}];
  restoreFormState(root(freshFields,freshDetails),captureFormState(old));
  assert.equal(freshFields[0].value,'未完成 <farm>');
  assert.equal(freshFields[1].checked,true);
  assert.equal(freshFields[2].value,'ms');
  assert.equal(freshDetails[0].open,true);
});

test('restoration does not put a draft into a different field', () => {
  const target = control('crop','Rice');
  restoreFormState(root([target]),captureFormState(root([control('name','My field')])));
  assert.equal(target.value,'Rice');
});

test('validation uses the current language and clears stale custom messages', async () => {
  const { localizeValidation } = await import('../src/language.mjs');
  const { setLocale, t } = await import('../src/i18n.mjs');
  const field = { validity: { valid: false, valueMissing: true }, message: 'old', setCustomValidity(value) { this.message = value; }, getAttribute() { return '2'; } };
  try {
    for (const locale of ['ms', 'zh-Hans']) {
      setLocale(locale);
      localizeValidation(field);
      assert.equal(field.message, t('Please complete this field.'));
    }
    field.validity = { valid: false, rangeUnderflow: true };
    localizeValidation(field);
    assert.equal(field.message, '请输入不小于 2 的值。');
    field.validity = { valid: true };
    localizeValidation(field);
    assert.equal(field.message, '');
  } finally { setLocale('en'); }
});
