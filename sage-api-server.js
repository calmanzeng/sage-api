#!/usr/bin/env node
/**
 * Sage API Server — 人生导航系统 HTTP API
 * 
 * 为零依赖设计，只使用 Node.js 内置 http 模块。
 * 
 * 启动:
 *   node sage-api-server.js
 *   node sage-api-server.js --port 3456
 * 
 * 端点:
 *   POST /api/qimen    奇门遁甲排盘
 *   POST /api/ziwei    紫微斗数排盘
 *   GET  /api/health   健康检查
 */

const http = require('http');
const url = require('url');

// ─── 引擎加载 ────────────────────────────────────────────────

// 奇门引擎 (本目录)
const qimen = require('./qimen');

// 紫微引擎 (izi墙-doushu 项目中的 iztro)
const ZIWEI_DIR = process.env.ZIWEI_DIR || require('path').join(require('os').homedir(), 'ziwei-doushu');
let iztro = null;
try {
  iztro = require(ZIWEI_DIR + '/node_modules/iztro');
} catch (e) {
  console.warn('[sage-api] ⚠️ 紫微斗数引擎未加载。如需使用请设置 ZIWEI_DIR 环境变量指向 ziwei-doushu 项目目录');
}

// ─── 工具函数 ────────────────────────────────────────────────

function parseDateTime(dateStr) {
  if (!dateStr || dateStr === 'now') return new Date();
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data, null, 2));
}

// ─── 路由处理 ────────────────────────────────────────────────

async function handleQimen(body) {
  const { date, method, purpose, location } = body;
  const dt = parseDateTime(date || 'now');
  if (!dt) return { error: true, message: '无效的日期格式' };

  try {
    return qimen.calculate(dt, {
      method: method || '时家',
      purpose: purpose || '综合',
      location: location || '默认位置',
    });
  } catch (e) {
    return { error: true, message: e.message };
  }
}

async function handleZiwei(body) {
  if (!iztro) {
    return { error: true, message: '紫微斗数引擎未加载。服务端需配置 ZIWEI_DIR 环境变量' };
  }

  const { year, month, day, hour, gender } = body;
  if (!year || !month || !day || hour === undefined || !gender) {
    return {
      error: true,
      message: '缺少必填字段：year, month, day, hour, gender (male/female)',
    };
  }
  if (!['male', 'female'].includes(gender)) {
    return { error: true, message: 'gender 必须是 male 或 female' };
  }

  try {
    const solarDate = `${year}-${month}-${day}`;
    const iztroGender = gender === 'male' ? '男' : '女';
    const astrolabe = iztro.astro.bySolar(solarDate, hour, iztroGender, true, 'zh-CN');

    return {
      birthInfo: { year, month, day, hour, gender },
      fiveElementsClass: astrolabe.fiveElementsClass,
      earthlyBranchOfSoulPalace: astrolabe.earthlyBranchOfSoulPalace,
      earthlyBranchOfBodyPalace: astrolabe.earthlyBranchOfBodyPalace,
      zodiac: astrolabe.zodiac,
      palaces: astrolabe.palaces.map(p => ({
        name: p.name,
        heavenlyStem: p.heavenlyStem,
        earthlyBranch: p.earthlyBranch,
        isBodyPalace: p.isBodyPalace ?? false,
        decadal: p.decadal ? { range: p.decadal.range } : null,
        majorStars: (p.majorStars || []).map(s => ({
          name: s.name,
          brightness: s.brightness,
          mutagen: s.mutagen,
        })),
        minorStars: (p.minorStars || []).map(s => ({
          name: s.name,
          type: s.type,
          mutagen: s.mutagen,
        })),
        adjectiveStars: (p.adjectiveStars || []).map(s => ({
          name: s.name,
          mutagen: s.mutagen,
        })),
        changsheng12: p.changsheng12 || [],
        boshi12: p.boshi12 || [],
        jiangqian12: p.jiangqian12 || [],
        suiqian12: p.suiqian12 || [],
      })),
    };
  } catch (e) {
    return { error: true, message: e.message };
  }
}

// ─── 服务器 ──────────────────────────────────────────────────

const PORT = parseInt(process.env.SAGE_API_PORT || process.argv[2] || '3456', 10);
const HOST = process.env.SAGE_API_HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  try {
    if (req.method === 'GET' && path === '/api/health') {
      return json(res, 200, {
        status: 'ok',
        version: '1.0.0',
        engines: { qimen: true, ziwei: iztro !== null },
      });
    }

    if (req.method === 'POST' && path === '/api/qimen') {
      const result = await handleQimen(await parseBody(req));
      return json(res, result.error ? 400 : 200, result);
    }

    if (req.method === 'POST' && path === '/api/ziwei') {
      const result = await handleZiwei(await parseBody(req));
      return json(res, result.error ? 400 : 200, result);
    }

    return json(res, 404, {
      error: true,
      message: '未知路径: ' + req.method + ' ' + path,
      available: ['GET /api/health', 'POST /api/qimen', 'POST /api/ziwei'],
    });
  } catch (e) {
    return json(res, 500, { error: true, message: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     ' + String.fromCharCode(0x1F9D9) + ' Sage API Server' + '                    ║');
  console.log('║     http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + '              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  端点:                                       ║');
  console.log('║  GET  /api/health    健康检查                  ║');
  console.log('║  POST /api/qimen    奇门遁甲排盘               ║');
  console.log('║  POST /api/ziwei    紫微斗数排盘               ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  奇门引擎: ' + (qimen ? '✅ 已加载' : '❌ 错误'));
  console.log('║  紫微引擎: ' + (iztro ? '✅ 已加载' : '⚠️ 未加载'));
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
