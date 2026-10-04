import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMobileInterfaceRelease} from './interfaceRelease.ts';
const release={schema:1,version:'build-b',builtAt:'2026-09-19T12:00:00.000Z',minNativeBuild:8,entry:'/mobile-app/index.html'};
test('mobile publication identifies a dedicated interface and its native compatibility',()=>assert.deepEqual(parseMobileInterfaceRelease(release),release));
test('a website URL, redirect, corrupt publication or legacy plugin contract is rejected',()=>{
 for(const invalid of [null,{},'<html/>',{...release,entry:'https://evil.test/app'},{...release,entry:'/todo'},{...release,schema:2},{...release,minNativeBuild:7},{...release,minNativeBuild:8.5},{...release,builtAt:'invalid'},{...release,version:''}]) assert.throws(()=>parseMobileInterfaceRelease(invalid));
});
