import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
// Exercise the real form and hook while replacing only the external widget/API.
function load(relativePath, mocks = {}, siteKey = 'public-test-key') {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    .replace('import.meta.env.VITE_HCAPTCHA_SITE_KEY', JSON.stringify(siteKey));
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports,
  );
  return module.exports;
}
const accountAuth = load('../src/lib/accountAuth.ts');
globalThis.window = { location: { origin: 'https://app.example.test' } };

function setup({ siteKey = 'public-test-key', recovery = false, failure = null } = {}) {
  const calls = [];
  const session = { user: { id: 'patient' } };
  const client = { auth: Object.fromEntries(['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'resend', 'updateUser', 'signOut'].map((method) => [method, async (...args) => {
    calls.push({ method, args });
    return { data: { session }, error: failure };
  }])) };
  const captcha = load('../src/components/AuthCaptcha.tsx', { '@hcaptcha/react-hcaptcha': 'hcaptcha' }, siteKey);
  const { AccountAuthView } = load('../src/components/AccountAuthView.tsx', {
    '../lib/supabase': { getSupabaseClient: () => client },
    '../lib/accountAuth': accountAuth,
    './AuthCaptcha': captcha,
  });
  let tree;
  const signedIn = [];
  act(() => { tree = create(React.createElement(AccountAuthView, {
    recovery, onSignedIn: (value) => signedIn.push(value), onPasswordUpdated() {}, onPreview() {},
  })); });
  const widget = () => tree.root.findByType('hcaptcha');
  const verify = (token = 'one-use-token') => act(() => widget().props.onVerify(token));
  const submit = async () => { await act(async () => { await tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); }); };
  const button = (text) => tree.root.findAllByType('button').find((node) => node.children.includes(text));
  const changeFlow = (text) => act(() => button(text).props.onClick());
  const input = (autoComplete, value) => act(() => tree.root.findAllByType('input').find((node) => node.props.autoComplete === autoComplete).props.onChange({ target: { value } }));
  return { tree, calls, signedIn, widget, verify, submit, changeFlow, input };
}

test('sign-in blocks both button and direct form submission until verified', async () => {
  const form = setup();
  assert.equal(form.tree.root.findByProps({ type: 'submit' }).props.disabled, true);
  await form.submit();
  assert.deepEqual(form.calls, []);
  form.verify();
  assert.equal(form.tree.root.findByProps({ type: 'submit' }).props.disabled, false);
  await form.submit();
  assert.equal(form.calls[0].method, 'signInWithPassword');
  assert.equal(form.calls[0].args[0].options.captchaToken, 'one-use-token');
  assert.equal(form.signedIn.length, 1);
  act(() => form.tree.unmount());
});

test('failed sign-in consumes the token and requires a fresh challenge', async () => {
  const form = setup({ failure: { code: 'captcha_failed' } });
  form.verify('first-token');
  await form.submit();
  assert.equal(form.signedIn.length, 0);
  assert.match(JSON.stringify(form.tree.toJSON()), /Security verification failed/);
  assert.equal(form.tree.root.findByProps({ type: 'submit' }).props.disabled, true);
  await form.submit();
  assert.equal(form.calls.length, 1);
  form.verify('second-token');
  await form.submit();
  assert.equal(form.calls[1].args[0].options.captchaToken, 'second-token');
  act(() => form.tree.unmount());
});

test('expiration, challenge timeout and widget errors invalidate verification', async () => {
  const form = setup();
  for (const event of ['onExpire', 'onChalExpired', 'onError']) {
    form.verify();
    act(() => form.widget().props[event]('script-error'));
    await form.submit();
    assert.equal(form.calls.length, 0);
    form.changeFlow('Retry security check');
    assert.equal(form.tree.root.findByProps({ type: 'submit' }).props.disabled, true);
  }
  act(() => form.tree.unmount());
});

test('switching forms discards tokens; recovery and resend send fresh tokens', async () => {
  const form = setup();
  form.verify('signin-token');
  form.changeFlow('Forgot password?');
  await form.submit();
  assert.equal(form.calls.length, 0);
  form.verify('recovery-token');
  await form.submit();
  assert.equal(form.calls[0].method, 'resetPasswordForEmail');
  assert.equal(form.calls[0].args[1].captchaToken, 'recovery-token');
  form.changeFlow('Back to sign in');
  form.changeFlow('Need another confirmation email?');
  form.verify('resend-token');
  await form.submit();
  assert.equal(form.calls[1].method, 'resend');
  assert.equal(form.calls[1].args[0].options.captchaToken, 'resend-token');
  act(() => form.tree.unmount());
});

test('registration sends CAPTCHA as an Auth option, not editable user metadata', async () => {
  const form = setup();
  form.changeFlow('New here? Create a Patient account');
  form.input('name', 'Test Patient');
  form.input('off', 'A01234567');
  form.input('email', 'patient@example.test');
  const passwords = form.tree.root.findAllByProps({ type: 'password' });
  act(() => passwords.forEach((field) => field.props.onChange({ target: { value: 'test-password-123' } })));
  form.verify('signup-token');
  await form.submit();
  assert.equal(form.calls[0].method, 'signUp');
  const options = form.calls[0].args[0].options;
  assert.equal(options.captchaToken, 'signup-token');
  assert.equal(options.data.captchaToken, undefined);
  // Resending on the newly displayed verification form requires a new token.
  assert.equal(form.tree.root.findByProps({ type: 'submit' }).props.disabled, true);
  act(() => form.tree.unmount());
});

test('authenticated password reset and unconfigured development omit the widget', async () => {
  const recovery = setup({ recovery: true });
  assert.equal(recovery.tree.root.findAllByType('hcaptcha').length, 0);
  assert.equal(recovery.tree.root.findByProps({ type: 'submit' }).props.disabled, false);
  act(() => recovery.tree.unmount());
  const development = setup({ siteKey: '' });
  assert.equal(development.tree.root.findAllByType('hcaptcha').length, 0);
  await development.submit();
  assert.equal(development.calls[0].args[0].options.captchaToken, undefined);
  act(() => development.tree.unmount());
});
