/*****************************************************************
 * Painel de avanço — Comissionamento das utilidades Cocamar
 * MSE / MTPIPING (RLF Piping)
 *
 * Guarda numa planilha o avanço lançado no painel, venha de que
 * celular ou computador vier. Duas abas são criadas sozinhas:
 *   Estado     — a situação atual de cada item (uma linha por item)
 *   Historico  — todo lançamento já feito, com quem e quando
 *
 * Antes de publicar, troque a senha da obra na linha abaixo.
 *****************************************************************/

var SENHA_DA_OBRA = 'cocamar2026';

var A_EST = 'Estado';
var A_HIS = 'Historico';

/* ---------- leitura: o painel chama no carregamento ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  return saida({ ok: true, itens: lerEstado(), hora: new Date().toISOString() }, p.callback);
}

/* ---------- gravação: o painel manda a fila de alterações ---------- */
function doPost(e) {
  var p = (e && e.parameter) || {}, b = {};
  try { b = JSON.parse(e.postData.contents); }
  catch (x) { return saida({ ok: false, erro: 'json' }, p.callback); }
  if (String(b.senha || '') !== SENHA_DA_OBRA) return saida({ ok: false, erro: 'senha' }, p.callback);
  var n = gravar(b.mudancas || [], String(b.nome || '').slice(0, 60) || 'sem nome');
  return saida({ ok: true, gravados: n, hora: new Date().toISOString() }, p.callback);
}

function saida(o, cb) {
  var t = JSON.stringify(o);
  if (cb) return ContentService.createTextOutput(cb + '(' + t + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- planilha ---------- */
function abas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var e = ss.getSheetByName(A_EST) || ss.insertSheet(A_EST);
  if (e.getLastRow() === 0) {
    e.appendRow(['chave', 'Sistema', 'Subsistema', 'Tipo', 'TAG / item', 'Valor', 'Observação', 'Quem', 'Quando']);
    e.setFrozenRows(1); e.hideColumns(1);
  }
  var h = ss.getSheetByName(A_HIS) || ss.insertSheet(A_HIS);
  if (h.getLastRow() === 0) {
    h.appendRow(['Quando', 'Quem', 'Sistema', 'Subsistema', 'Tipo', 'TAG / item', 'De', 'Para']);
    h.setFrozenRows(1);
  }
  return { e: e, h: h };
}

function lerEstado() {
  var e = abas().e, n = e.getLastRow();
  if (n < 2) return [];
  var v = e.getRange(2, 1, n - 1, 9).getValues(), out = [];
  for (var i = 0; i < v.length; i++) {
    var c = String(v[i][0]); if (!c) continue;
    var p = c.split('|');
    // [sistema, subsistema, chave do item, valor, observação, data]
    out.push([p[0], p[1], p.slice(2).join('|'), v[i][5], v[i][6], fdata(v[i][8])]);
  }
  return out;
}

function fdata(d) {
  if (!d) return '';
  try { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
  catch (x) { return ''; }
}

function gravar(ms, quem) {
  if (!ms.length) return 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var A = abas(), e = A.e, n = e.getLastRow(), idx = {}, v = [];
    if (n > 1) {
      v = e.getRange(2, 1, n - 1, 9).getValues();
      for (var i = 0; i < v.length; i++) idx[String(v[i][0])] = i;
    }
    var hist = [], agora = new Date();
    for (var j = 0; j < ms.length; j++) {
      var m = ms[j], obs = (m.o !== undefined);
      var chave = m.sy + '|' + m.sb + '|' + (obs ? '__obs' : m.k);
      var tipo, tag;
      if (obs) { tipo = 'Observação'; tag = ''; }
      else { var pk = String(m.k).split('|'); tipo = pk[0] || ''; tag = pk.slice(1).join('|'); }
      var val = obs ? '' : m.v, txt = obs ? m.o : '';
      var linha = [chave, m.sy, m.sb, tipo, tag, val, txt, quem, agora];
      if (idx[chave] !== undefined) {
        var k = idx[chave];
        hist.push([agora, quem, m.sy, m.sb, tipo, tag, obs ? v[k][6] : v[k][5], obs ? txt : val]);
        v[k] = linha;
      } else {
        hist.push([agora, quem, m.sy, m.sb, tipo, tag, '', obs ? txt : val]);
        idx[chave] = v.length; v.push(linha);
      }
    }
    if (v.length) e.getRange(2, 1, v.length, 9).setValues(v);
    if (hist.length) A.h.getRange(A.h.getLastRow() + 1, 1, hist.length, 8).setValues(hist);
    return ms.length;
  } finally { lock.releaseLock(); }
}
