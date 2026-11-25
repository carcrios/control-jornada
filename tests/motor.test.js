// Pruebas del motor de liquidación. Ejecutar: node tests/motor.test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const M = new Function(fs.readFileSync(path.join(__dirname, '../apps-script/Motor.gs'), 'utf8') + ';return Motor;')();
let ok = 0, mal = 0;
function t(n, f) { try { f(); ok++; } catch (e) { mal++; console.log('✗ ' + n + '\n   ' + e.message); } }
const H = { e: '07:00', s: '16:24', ai: '12:00', af: '13:00', tol: 5 }; // 8,4 h × 5 días = 42 h
const LV = { 1: H, 2: H, 3: H, 4: H, 5: H };
const eq = (a, b, m) => assert.strictEqual(a, b, m);

t('festivos 2026: 18 días y fechas clave', () => {
  const f = M.festivos(2026); eq(Object.keys(f).length, 18);
  ['2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25'].forEach(x => assert(f[x], x));
});
t('festivos 2027 y 2028 (Pascua)', () => { eq(M.pascua(2027), '2027-03-28'); eq(M.pascua(2028), '2028-04-16'); assert(M.festivos(2027)['2027-03-25']); });
t('recargo dominical escalonado Ley 2466', () => { eq(M.recDominical('2026-06-28', M.cfg()), 0.8); eq(M.recDominical('2026-07-05', M.cfg()), 0.9); eq(M.recDominical('2027-07-04', M.cfg()), 1); });
t('jornada del horario descuenta almuerzo', () => eq(M.jornadaMin(H), 504));
t('día normal completo: 8,4 h ordinarias, sin extras', () => {
  const r = M.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salAlm: '12:00', entAlm: '13:00', salida: '16:24' }, H);
  eq(r.ordDiu, 504); eq(r.extraCalculadaMin, 0); eq(r.tardanzaMin, 0);
});
t('olvidó marcar almuerzo: se asume la franja programada', () => {
  const r = M.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salida: '16:24' }, H);
  eq(r.trabajadoMin, 504); assert(r.almuerzoAsumido);
});
t('marcó salida a almuerzo pero no el regreso: descuenta la duración programada', () => {
  eq(M.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salAlm: '12:30', salida: '16:24' }, H).trabajadoMin, 504);
});
t('festivo trabajado sin horario: no se asume almuerzo', () => {
  const r = M.liquidarDia({ fecha: '2026-11-16', entrada: '07:00', salida: '12:00' }, null);
  eq(r.trabajadoMin, 300); eq(r.domDiu, 300); assert(!r.almuerzoAsumido);
});
t('llegar antes del horario no genera tiempo extra (configurable)', () => {
  const d = { fecha: '2026-11-10', entrada: '06:40', salAlm: '12:00', entAlm: '13:00', salida: '16:24' };
  eq(M.liquidarDia(d, H).extraCalculadaMin, 0); eq(M.liquidarDia(d, H).trabajadoMin, 504);
  eq(M.liquidarDia(d, H, { contarAntesDeEntrada: true }).extraCalculadaMin, 20);
});
t('sin salida: día incompleto, 0 horas', () => { const r = M.liquidarDia({ fecha: '2026-11-10', entrada: '07:00' }, H); assert(r.incompleto); eq(r.trabajadoMin, 0); });
t('extras: 2 h diurnas tras la jornada', () => {
  const r = M.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salAlm: '12:00', entAlm: '13:00', salida: '18:24' }, H);
  eq(r.extraCalculadaMin, 120); eq(r.extDiu, 120);
});
t('extras sin aprobar no se pagan', () => {
  const r = M.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salAlm: '12:00', entAlm: '13:00', salida: '18:24' }, H, null, { extraAprobadaMin: 60 });
  eq(r.extDiu, 60); eq(r.extraSinAprobarMin, 60);
});
t('extra nocturna desde las 19:00', () => {
  const r = M.liquidarDia({ fecha: '2026-11-10', entrada: '07:00', salAlm: '12:00', entAlm: '13:00', salida: '20:24' }, H);
  eq(r.extDiu, 156); eq(r.extNoc, 84);
});
t('turno que cruza medianoche (domingo a lunes festivo y turno nocturno normal)', () => {
  const r = M.liquidarDia({ fecha: '2026-11-15', entrada: '22:00', salida: '06:00' }, null);
  eq(r.trabajadoMin, 480); eq(r.domNoc, 480);
  const r2 = M.liquidarDia({ fecha: '2026-11-10', entrada: '22:00', salida: '06:00' }, { e: '22:00', s: '06:00' }); eq(r2.ordNoc, 480); eq(r2.extraCalculadaMin, 0);
});
t('tardanza respeta la tolerancia', () => {
  eq(M.liquidarDia({ fecha: '2026-11-10', entrada: '07:04', salida: '16:24' }, H).tardanzaMin, 0);
  eq(M.liquidarDia({ fecha: '2026-11-10', entrada: '07:20', salida: '16:24' }, H).tardanzaMin, 20);
});
t('tope semanal de 42 h: lo del sábado es extra', () => {
  const dias = ['09', '10', '11', '12', '13'].map(d => ({ fecha: '2026-11-' + d, entrada: '07:00', salida: '16:24', horario: H }));
  dias.push({ fecha: '2026-11-14', entrada: '07:00', salida: '11:00', horario: null });
  const r = M.liquidarDias(dias, null, null); eq(r['2026-11-14'].extraCalculadaMin, 240); eq(r['2026-11-13'].extraCalculadaMin, 0);
});
t('aviso por superar 2 h extra en un día', () => {
  const av = M.avisosExtras(M.liquidarDias([{ fecha: '2026-11-10', entrada: '07:00', salida: '22:54', horario: H }]), null); eq(av.length, 1); eq(av[0].tipo, 'dia');
});
t('días de nómina: quincena 15, febrero 30, segunda quincena de mes de 31 = 15', () => {
  eq(M.diasNomina('2026-11-01', '2026-11-15'), 15); eq(M.diasNomina('2026-11-16', '2026-11-30'), 15);
  eq(M.diasNomina('2026-02-01', '2026-02-28'), 30); eq(M.diasNomina('2026-10-16', '2026-10-31'), 15); eq(M.diasNomina('2026-02-16', '2026-02-28'), 15);
});
t('periodo quincenal y mensual', () => { eq(M.periodoDe('2026-11-20', 'quincenal').desde, '2026-11-16'); eq(M.periodoDe('2026-02-20', 'mensual').hasta, '2026-02-28'); });
const U = { salario: 1750905, tipoPago: 'mensual' };
function quincena(extra) {
  const dias = [];
  for (let d = 1; d <= 15; d++) { const f = '2026-11-' + (d < 10 ? '0' + d : d); if (M.horarioDia(LV, f)) dias.push({ fecha: f, entrada: '07:00', salAlm: '12:00', entAlm: '13:00', salida: '16:24', horario: H }); }
  return Object.assign({ usuario: U, desde: '2026-11-01', hasta: '2026-11-15', dias, horario: LV }, extra || {});
}
t('quincena completa con mínimo: salario + auxilio − 8 %', () => {
  const r = M.liquidarPeriodo(quincena());
  eq(r.conceptos.find(x => x.cod === 'SAL').valor, 875453); eq(r.conceptos.find(x => x.cod === 'AUX').valor, 124548);
  eq(r.deducciones, 70036); eq(r.ausencias, 0); eq(r.neto, 875453 + 124548 - 70036);
});
t('valor hora del mínimo 2026 con divisor 210 = $8.338', () => eq(M.liquidarPeriodo(quincena()).valorHora, 8338));
t('ausencia sin justificar descuenta un día y su auxilio', () => {
  const p = quincena(); p.dias = p.dias.filter(d => d.fecha !== '2026-11-10');
  const r = M.liquidarPeriodo(p); eq(r.ausencias, 1); eq(r.conceptos.find(x => x.cod === 'AUS').valor, -58364); eq(r.conceptos.find(x => x.cod === 'AUX').cantidad, 14);
});
t('permiso remunerado aprobado cubre la ausencia', () => {
  const p = quincena({ permisos: [{ desde: '2026-11-10', hasta: '2026-11-10', remunerado: true, tipo: 'luto' }] }); p.dias = p.dias.filter(d => d.fecha !== '2026-11-10');
  const r = M.liquidarPeriodo(p); eq(r.ausencias, 0); assert(!r.conceptos.find(x => x.cod === 'AUS'));
});
t('permiso no remunerado por horas (3 h = $25.013)', () => {
  const r = M.liquidarPeriodo(quincena({ permisos: [{ desde: '2026-11-10', hasta: '2026-11-10', remunerado: false, horas: 3, tipo: 'personal' }] }));
  eq(r.conceptos.find(x => x.cod === 'PNH').valor, -25013);
});
t('incapacidad general: 66,67 % con piso de salario mínimo', () => {
  const p = quincena({ incapacidades: [{ desde: '2026-11-09', hasta: '2026-11-11', tipo: 'general' }] }); p.dias = p.dias.filter(d => d.fecha < '2026-11-09' || d.fecha > '2026-11-11');
  const r = M.liquidarPeriodo(p); eq(r.ausencias, 0); eq(r.conceptos.find(x => x.cod === 'ING').valor, 175091); eq(r.conceptos.find(x => x.cod === 'SAL').cantidad, 12);
});
t('extras aprobadas entran a la nómina con 25 %', () => {
  const p = quincena({ extras: { '2026-11-10': 120 } }); p.dias.find(d => d.fecha === '2026-11-10').salida = '18:24';
  const r = M.liquidarPeriodo(p); eq(r.conceptos.find(x => x.cod === 'HED').valor, Math.round(2 * 1750905 / 210 * 1.25)); eq(r.horas.extras, 2);
});
t('festivo trabajado paga hora + 90 % ($15.842 por hora)', () => {
  const p = quincena(); p.dias.push({ fecha: '2026-11-02', entrada: '07:00', salida: '12:00', horario: null });
  eq(M.liquidarPeriodo(p).conceptos.find(x => x.cod === 'DF').valor, Math.round(5 * 1750905 / 210 * 1.9));
});
t('sin auxilio por encima de 2 SMMLV; solidaridad desde 4 SMMLV', () => {
  const r = M.liquidarPeriodo(quincena({ usuario: { salario: 7100000 } })); assert(!r.conceptos.find(x => x.cod === 'AUX')); assert(r.deduccionesDet.find(x => x.cod === 'FSP'));
});
t('corte a mitad de periodo: solo cuenta lo transcurrido', () => { const r = M.liquidarPeriodo(quincena({ corte: '2026-11-06' })); eq(r.diasNomina, 6); eq(r.ausencias, 0); });
t('ingreso a mitad de periodo no genera ausencias previas', () => {
  const p = quincena({ ingreso: '2026-11-09' }); p.dias = p.dias.filter(d => d.fecha >= '2026-11-09'); const r = M.liquidarPeriodo(p); eq(r.ausencias, 0); eq(r.diasNomina, 7);
});
t('pago por día: paga días trabajados, sin ausencias', () => {
  const p = quincena({ usuario: { salario: 80000, tipoPago: 'dia' } }); p.dias = p.dias.slice(0, 5);
  const r = M.liquidarPeriodo(p); eq(r.conceptos.find(x => x.cod === 'SAL').valor, 400000); eq(r.ausencias, 0);
});
t('pago por día: gana el descanso dominical y festivo, y cobra incapacidad y vacaciones', () => {
  const p = quincena({ usuario: { salario: 58364, tipoPago: 'dia' } }); const r = M.liquidarPeriodo(p);
  eq(r.conceptos.find(x => x.cod === 'SAL').cantidad, 9); eq(r.conceptos.find(x => x.cod === 'DR').cantidad, 4); // descansos: domingos 1, 8 y 15 y festivo del 2
  const q = quincena({ usuario: { salario: 58364, tipoPago: 'dia' }, incapacidades: [{ desde: '2026-11-03', hasta: '2026-11-06', tipo: 'general' }] }); q.dias = q.dias.filter(d => d.fecha > '2026-11-06');
  assert(M.liquidarPeriodo(q).conceptos.find(x => x.cod === 'ING').valor > 0);
});
t('pago por día: trabajar el domingo conserva el descanso y suma el recargo', () => {
  const base = M.liquidarPeriodo(quincena({ usuario: { salario: 58364, tipoPago: 'dia' } }));
  const p = quincena({ usuario: { salario: 58364, tipoPago: 'dia' } }); p.dias.push({ fecha: '2026-11-08', entrada: '07:00', salida: '14:00', horario: null });
  const r = M.liquidarPeriodo(p), dr = (x) => x.conceptos.find((k) => k.cod === 'DR').cantidad;
  eq(dr(r), dr(base), 'el domingo trabajado no le quita el descanso remunerado');
  assert(r.devengado - base.devengado >= 58364 + 7 * 58364 / 7 * 0.9 - 2, 'cobra el día y el recargo dominical');
});
t('vacaciones: 15 días por cada 360 de servicio (meses de 30 días)', () => { eq(M.vacacionesCausadas('2025-01-01', '2025-12-30'), 15); eq(M.vacacionesCausadas('2026-01-01', '2026-06-30'), 7.5); });
t('fecha de retiro: no se liquida después de salir', () => {
  const p = quincena({ retiro: '2026-11-05' }); p.dias = p.dias.filter(d => d.fecha <= '2026-11-05'); const r = M.liquidarPeriodo(p); eq(r.diasNomina, 5); eq(r.ausencias, 0);
});
t('sábado no programado: todo es extra y requiere aprobación', () => {
  const dias = [{ fecha: '2026-11-07', entrada: '07:00', salida: '15:00', horario: null, libre: true }];
  eq(M.liquidarDias(dias, null, null)['2026-11-07'].extraCalculadaMin, 420, 'descuenta 1 h de almuerzo'); eq(M.liquidarDias(dias, null, {})['2026-11-07'].extraSinAprobarMin, 420);
});
t('horario de más de 9 h diarias: el exceso es extra', () => eq(M.liquidarDia({ fecha: '2026-11-10', entrada: '06:00', salida: '17:00' }, { e: '06:00', s: '17:00', ai: '12:00', af: '12:30' }).extraCalculadaMin, 90));
t('domingo habitual (3 o más en el mes, en el horario) paga solo el recargo; ocasional paga hora + recargo', () => {
  const HD = { e: '07:00', s: '15:00' }, base = { usuario: U, desde: '2026-11-01', hasta: '2026-11-15', corte: '2026-11-08', horario: { 0: HD } };
  const hab = M.liquidarPeriodo(Object.assign({ descansosMes: { '2026-11': 3 }, dias: [{ fecha: '2026-11-08', entrada: '07:00', salida: '15:00', horario: HD }] }, base)).conceptos.find(x => x.cod === 'DF').valor;
  const ocaH = M.liquidarPeriodo(Object.assign({ dias: [{ fecha: '2026-11-08', entrada: '07:00', salida: '15:00', horario: HD }] }, base)).conceptos.find(x => x.cod === 'DF').valor;
  eq(ocaH, Math.round(8 * 1750905 / 210 * 1.9), 'en el horario pero solo 1 en el mes: ocasional');
  const oca = M.liquidarPeriodo(Object.assign({ dias: [{ fecha: '2026-11-08', entrada: '07:00', salida: '15:00', horario: null }] }, base)).conceptos.find(x => x.cod === 'DF').valor;
  eq(hab, Math.round(8 * 1750905 / 210 * 0.9)); eq(oca, Math.round(7 * 1750905 / 210 * 1.9), 'sin horario descuenta 1 h de almuerzo');
});
t('solidaridad por IBC con tramos y tope de 25 SMMLV', () => {
  const r17 = M.liquidarPeriodo(quincena({ usuario: { salario: 17.5 * 1750905 } })); eq(r17.deduccionesDet.find(x => x.cod === 'FSP').cantidad, '1.4 %');
  const r50 = M.liquidarPeriodo(quincena({ usuario: { salario: 50000000 } })); eq(r50.deduccionesDet.find(x => x.cod === 'SLD').valor, Math.round(1750905 * 25 / 2 * 0.04));
});
t('ausencia: dominical no causado solo si la empresa lo activa; permiso por horas sin asistir es ausencia', () => {
  const p = quincena(); p.dias = p.dias.filter(d => d.fecha !== '2026-11-10');
  assert(!M.liquidarPeriodo(p).conceptos.find(x => x.cod === 'DNC')); eq(M.liquidarPeriodo(p, { descontarDominical: true }).conceptos.find(x => x.cod === 'DNC').valor, -58364);
  const q = quincena({ permisos: [{ desde: '2026-11-10', hasta: '2026-11-10', remunerado: true, horas: 2, tipo: 'cita_medica' }] }); q.dias = q.dias.filter(d => d.fecha !== '2026-11-10'); eq(M.liquidarPeriodo(q).ausencias, 1);
});
t('licencia remunerada de día completo no causa auxilio de transporte', () => {
  const p = quincena({ permisos: [{ desde: '2026-11-09', hasta: '2026-11-13', remunerado: true, tipo: 'luto' }] }); p.dias = p.dias.filter(d => d.fecha < '2026-11-09' || d.fecha > '2026-11-13');
  eq(M.liquidarPeriodo(p).conceptos.find(x => x.cod === 'AUX').cantidad, 10);
});
t('vacaciones: 15 días hábiles por año y conteo de hábiles', () => { eq(M.vacacionesCausadas('2025-11-15', '2026-11-15'), 15); eq(M.diasHabiles('2026-11-09', '2026-11-20', null, false), 9); });
t('catálogo de permisos con norma', () => assert(M.PERMISOS.every(p => p.norma && p.cat)));
t('nómina: almuerzo en festivo, prórrogas de incapacidad, febrero, no salarial sobre el 40 % y vigencias', () => {
  const fest = M.liquidarDia({ fecha: '2026-11-16', entrada: '07:00', salida: '16:24' }, null); eq(fest.trabajadoMin, 504, 'festivo de 9,4 h descuenta 1 h');
  const S2 = { salario: 2 * 1750905, tipoPago: 'mensual' }, incs = [['2026-01-01', '2026-01-30'], ['2026-01-31', '2026-03-01'], ['2026-03-02', '2026-03-31'], ['2026-04-01', '2026-04-30']].map(([d, h]) => ({ desde: d, hasta: h, tipo: 'general' }));
  const abr = M.liquidarPeriodo({ usuario: S2, desde: '2026-04-01', hasta: '2026-04-15', dias: [], incapacidades: incs });
  assert(abr.conceptos.some(x => x.cod === 'IN5'), 'desde el día 91 de la cadena paga 50 %');
  const feb = M.liquidarPeriodo({ usuario: S2, desde: '2027-02-16', hasta: '2027-02-28', dias: [], incapacidades: [{ desde: '2027-02-01', hasta: '2027-02-28', tipo: 'general' }] });
  assert(!feb.conceptos.some(x => x.cod === 'SAL'), 'febrero completo incapacitado no paga salario de relleno');
  const bn = M.liquidarPeriodo({ usuario: U, desde: '2026-11-01', hasta: '2026-11-30', dias: [], novedades: [{ fecha: '2026-11-10', concepto: 'Bono', valor: 1500000, salarial: false }] });
  assert(bn.ibc > 1750905, 'el exceso no salarial entra al IBC: ' + bn.ibc);
  eq(M.vigente(M.cfgDe ? M.cfgDe() : {}, '2026-07-01').divisorMensual || 220, 220);
});
console.log(`Motor: ${ok} pruebas correctas, ${mal} con error`); process.exit(mal ? 1 : 0);
