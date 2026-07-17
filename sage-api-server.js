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
const qimen = require('./qimen/qimen');

// 紫微引擎 — 优先从项目依赖加载，其次从 ZIWEI_DIR 环境变量
let iztro = null;
try {
  iztro = require('iztro');
} catch (e1) {
  try {
    const ZIWEI_DIR = process.env.ZIWEI_DIR || require('path').join(require('os').homedir(), 'ziwei-doushu');
    iztro = require(ZIWEI_DIR + '/node_modules/iztro');
  } catch (e2) {
    try {
      iztro = require(require('path').join(__dirname, 'node_modules', 'iztro'));
    } catch (e3) {
      console.warn('[sage-api] ⚠️ 紫微斗数引擎未加载。请安装 iztro: npm install iztro');
    }
  }
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

const PORT = parseInt(process.env.PORT || process.env.SAGE_API_PORT || process.argv[2] || '3456', 10);
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

        if (req.method === 'GET' && (path === '/' || path === '')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end('<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Sage 人生导航系统 API</title>\n<style>\n*{margin:0;padding:0;box-sizing:border-box}\nbody{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0f0f1a;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}\n.card{background:#1a1a2e;border-radius:16px;padding:40px;max-width:640px;width:100%;border:1px solid #2a2a4a;text-align:center}\nh1{font-size:2rem;margin-bottom:8px}\n.sub{color:#8888aa;margin-bottom:24px;font-size:0.95rem}\n.endpoints{text-align:left;margin:20px 0}\n.endpoint{background:#252545;border-radius:10px;padding:14px 18px;margin:8px 0;display:flex;align-items:center;gap:12px;font-family:SF Mono,Fira Code,monospace;font-size:0.9rem}\n.method{display:inline-block;padding:3px 10px;border-radius:6px;font-weight:600;font-size:0.8rem;min-width:48px;text-align:center}\n.get{background:#1a4a3a;color:#4ade80}\n.post{background:#3a1a4a;color:#c084fc}\n.desc{color:#aaaacc;font-size:0.85rem;margin-left:auto}\n.status{display:flex;gap:12px;justify-content:center;margin:20px 0}\n.badge{padding:6px 16px;border-radius:20px;font-size:0.85rem;background:#252545}\n.badge.ok{background:#1a4a3a;color:#4ade80}\n.badge.warn{background:#4a3a1a;color:#fbbf24}\n.footer{color:#555577;font-size:0.8rem;margin-top:24px}\n</style>\n</head>\n<body>\n<div class="card">\n<h1>Sage 人生导航系统</h1>\n<p class="sub">紫微斗数 x 终身奇门 x 时家奇门 三件套综合命理 API</p>\n<div class="status">\n<span class="badge ok">在线</span>\n<span class="badge ok">奇门</span>\n<span class="badge warn">紫微</span>\n</div>\n<div class="endpoints">\n<div class="endpoint"><span class="method get">GET</span> /api/health <span class="desc">健康检查</span></div>\n<div class="endpoint"><span class="method post">POST</span> /api/qimen <span class="desc">奇门遁甲排盘</span></div>\n<div class="endpoint"><span class="method post">POST</span> /api/ziwei <span class="desc">紫微斗数排盘</span></div>\n</div>\n<p class="footer">基于 Node.js 零依赖设计 部署于 Railway</p>\n</div>\n</body>\n</html>');
    }

    return json(res, 404, {
      error: true,
      message: '未知路径: ' + req.method + ' ' + path,
      available: ['GET /api/health', 'POST /api/qimen', 'POST /api/ziwei'],
    });return json(res, 404, {
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
